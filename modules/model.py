import torch
from transformers import GPT2LMHeadModel, GPT2TokenizerFast
from accelerate import Accelerator

accelerator = Accelerator()
device = accelerator.device

model_id = "openai-community/gpt2-large"
model = GPT2LMHeadModel.from_pretrained(model_id).to(device)
model.eval()

tokenizer = GPT2TokenizerFast.from_pretrained(model_id)