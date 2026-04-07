import torch
import numpy as np
from PIL import Image
import pyiqa
from torchvision.transforms.functional import to_tensor as img2tensor

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
brisque_metric = pyiqa.create_metric('brisque', device=device)

def brisque(images):
    import os
    results = []
    for image in images:
        if isinstance(image, str):
            filename = os.path.basename(image)
        else:
            filename = image.filename
        
        img = Image.open(image).convert('RGB')
        img_input = np.array(img)
        img_tensor = img2tensor(img_input).unsqueeze(0).to(device)
        with torch.no_grad():
            score = brisque_metric(img_tensor).item()
        results.append({
            'filename': filename,
            'brisque_score': round(score, 2)
        })
    return results