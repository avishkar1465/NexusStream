import torch
import re
from tqdm import tqdm
from .model import model, tokenizer, device


def perplexity(file):
    raw_text = file.read().decode('utf-8')
    
    text = re.sub(r'\n+', '\n', raw_text)
    text = re.sub(r' +', ' ', text)
    text = ''.join(char for char in text if char.isprintable() or char == '\n')
    
    encodings = tokenizer(text + tokenizer.eos_token, return_tensors="pt")
    
    max_length = model.config.n_positions
    stride = 512
    seq_len = encodings.input_ids.size(1)

    nll_sum = 0.0
    n_tokens = 0
    prev_end_loc = 0
    
    for begin_loc in tqdm(range(0, seq_len, stride)):
        end_loc = min(begin_loc + max_length, seq_len)
        trg_len = end_loc - prev_end_loc
        
        input_ids = encodings.input_ids[:, begin_loc:end_loc].to(device)
        target_ids = input_ids.clone()
        
        target_ids[:, :-trg_len] = -100

        with torch.no_grad():
            outputs = model(input_ids, labels=target_ids)
            neg_log_likelihood = outputs.loss * trg_len

        nll_sum += neg_log_likelihood
        n_tokens += trg_len
        prev_end_loc = end_loc
        
        if end_loc == seq_len:
            break

    ppl = torch.exp(nll_sum / n_tokens)
    return ppl.item()