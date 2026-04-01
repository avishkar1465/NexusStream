import os
import tempfile
import cv2
import torch
import numpy as np
import pyiqa

class VideoNIQEValidator:
    def __init__(self):
        # Auto-detect GPU if available, otherwise fallback to CPU
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize NIQE metric (loads weights to the selected device)
        # NIQE is opinion-unaware: Lower score = Better quality
        self.metric = pyiqa.create_metric('niqe', device=self.device)

    def validate(self, file_bytes, extract_fps=1):
        """
        Validates video quality by extracting frames at a set interval
        and calculating their Natural Scene Statistics (NSS).
        """
        scores = []
        
        # 1. Create a secure, temporary file on the disk
        temp_fd, temp_path = tempfile.mkstemp(suffix=".mp4")
        
        try:
            # Write the raw bytes to the physical temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(file_bytes)

            # 2. Open the video using OpenCV
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                return {"status": False, "error": "OpenCV could not decode the video file."}

            # Get the video's native frame rate
            native_fps = cap.get(cv2.CAP_PROP_FPS)
            if native_fps <= 0:
                native_fps = 30 # Fallback safety
                
            # Calculate how many frames to skip to achieve the desired extract_fps (e.g., 1 frame per sec)
            frame_interval = max(1, int(native_fps / extract_fps))
            
            frame_count = 0
            
            # 3. Frame Extraction & Scoring Loop
            while True:
                ret, frame = cap.read()
                if not ret:
                    break # End of video
                
                # Only process frames at the specified interval
                if frame_count % frame_interval == 0:
                    # OpenCV loads in BGR. We must convert to RGB for the AI model.
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    
                    # Convert numpy array [H, W, C] to PyTorch tensor [1, C, H, W] normalized to [0, 1]
                    frame_tensor = torch.from_numpy(frame_rgb).float() / 255.0
                    frame_tensor = frame_tensor.permute(2, 0, 1).unsqueeze(0).to(self.device)
                    
                    # Calculate NIQE score
                    with torch.no_grad():
                        score = self.metric(frame_tensor).item()
                        scores.append(score)
                        
                frame_count += 1
                
        finally:
            # 4. Mandatory Cleanup: Release memory and delete the temp file
            if 'cap' in locals():
                cap.release()
            try:
                os.remove(temp_path)
            except OSError:
                pass # File already deleted or locked

        # 5. The Quality Gate Logic
        if not scores:
             return {"status": False, "error": "Video was too short or unreadable to extract frames."}

        # Calculate statistics
        mean_score = round(float(np.mean(scores)), 2)
        worst_score = round(float(np.max(scores)), 2) # Remember: Max = Worst in NIQE
        
        # 85th Percentile: What is the score of the worst 15% of the video?
        p85_score = round(float(np.percentile(scores, 85)), 2)
        
        # Threshold Logic: 
        # Reject if the 85th percentile is higher than 7.5 (meaning a large chunk of the video is heavily distorted)
        passed = p85_score <= 7.5

        return {
            'status': passed,
            'scores': {
                'niqe_mean': mean_score,
                'niqe_worst': worst_score,
                'niqe_p85': p85_score,
                'frames_analyzed': len(scores)
            },
            'result': 'Accepted' if passed else 'Rejected: Video contains significant blur or compression artifacts.'
        }