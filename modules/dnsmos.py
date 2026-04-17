import os
import tempfile
import torch
import librosa
from torchmetrics.audio.dnsmos import DeepNoiseSuppressionMeanOpinionScore

class DNSMOS:
    def __init__(self):
        # Initializing the metric once to save resources
        self.metric = DeepNoiseSuppressionMeanOpinionScore(fs=16000, personalized=False)

    def validate(self, file_bytes):
        # 1. Create a secure, temporary file on the disk
        temp_fd, temp_path = tempfile.mkstemp(suffix=".tmp")
        
        try:
            # Write the raw bytes to the physical temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(file_bytes)

            # 2. THE LIBROSA BYPASS
            # This single line reads the file (wav, mp3, m4a), converts to Mono, 
            # and resamples to exactly 16000 Hz using the FFmpeg executable in your PATH.
            waveform_np, _ = librosa.load(temp_path, sr=16000, mono=True)
            
            # Convert the numpy array back into a PyTorch tensor shape [1, Time]
            waveform = torch.from_numpy(waveform_np).unsqueeze(0).float()

            with torch.no_grad():
                scores = self.metric(waveform)

            # Extraction of scores based on P.808 standards
            sig_score = round(scores[1].item(), 2)  # Speech Quality
            bak_score = round(scores[2].item(), 2)  # Background Noise
            ovr_score = round(scores[3].item(), 2)  # Overall Quality

            # Quality Gate thresholding
            passed = ovr_score >= 2.0

            return {
                'status': passed,
                'scores': {
                    'speech_quality': sig_score,
                    'background_noise': bak_score,
                    'overall_quality': ovr_score
                }, 
                'result': 'Accepted' if passed else 'Rejected'
            }
            
        finally:
            # 3. Mandatory Cleanup
            try:
                os.remove(temp_path)
            except OSError:
                pass
