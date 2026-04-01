# NexusStream: Distributed Community-Driven Data Marketplace

NexusStream is a decentralized platform designed to crowdsource and validate multi-modal data (audio, image, text, and video) from a global community. By implementing an automated "Quality Gate," the platform ensures that only high-fidelity data is available for purchase, replacing slow manual auditing with algorithmic scoring.

## 🚀 Architecture Overview

The project follows a distributed, asynchronous processing model to handle large-scale multimedia ingestion without compromising API performance.

- **API Gateway**: Built with Flask, it handles user authentication and multi-modal file uploads.
- **Message Broker**: Redis serves as the primary post office, holding task messages for the validation workers.
- **Asynchronous Processing**: Celery Workers pull tasks from Redis to perform CPU-intensive validation metrics in parallel.
- **Storage Layer**: PostgreSQL manages metadata and quality scores, while AWS S3/MinIO stores the raw and validated files.

## 🛠️ Validation Methods (The Quality Gate)

NexusStream uses No-Reference (NR) metrics, meaning it evaluates data quality by analyzing its internal statistical properties without needing a "perfect" original version for comparison.

### 1. Audio Validation: DNSMoS

Deep Noise Suppression Mean Opinion Score (DNSMoS) is a deep neural network-based metric that simulates human perception of speech quality.

**Logic**: Maps input speech features to a Mean Opinion Score (MOS) from 1 (Poor) to 5 (Excellent).

**Evaluation Breakdown**:
- **SIG**: Speech signal quality (how natural the voice sounds).
- **BAK**: Background noise level (detects intrusive hums or clicks).
- **OVRL**: Combined overall quality score.

**Implementation**: Utilizes torchmetrics[audio] for high-performance inference.

### 2. Image Validation: BRISQUE

The Blind/Referenceless Image Spatial Quality Evaluator (BRISQUE) evaluates images by identifying deviations in Natural Scene Statistics (NSS).

**Logic**: It extracts 36 characteristic features (like blur or noise) and feeds them into a Support Vector Regression (SVR) model.

**Scoring**: Typically ranges from 0 to 100, where lower values indicate better perceptual quality.

**Implementation**: Uses the pyiqa toolbox for Python-based analysis.

### 3. Video Validation: NIQE

The Naturalness Image Quality Evaluator (NIQE) is an "opinion-unaware" metric, trained only on pristine natural images.

**Logic**: It measures the "distance" between the statistics of sampled video frames and a model of "perfectly natural" image patches.

**Process**: The system extracts frames at regular intervals (e.g., 1 frame per second) using OpenCV and aggregates the results to find a global naturalness score.

**Implementation**: Optimized via PyIQA to focus on structural distortions and transmission artifacts.

### 4. Text Validation: Perplexity

Perplexity quantifies the "uncertainty" or "surprise" a language model (GPT-2) feels when processing a sequence of text.

**Logic**: It is the exponentiated average negative log-likelihood of a sequence.

**Technique**: Uses a Strided Sliding Window (e.g., 1024 max length with a 512-token stride) to maintain linguistic context while processing large .txt files.

**Scores**: Natural English typically scores between 20–60. High-perplexity scores (>200) indicate gibberish, code snippets, or bot-generated spam.

**Implementation**: Built using the transformers and accelerate libraries.

## 💻 Tech Stack

- **Backend**: Flask (Python)
- **Distributed Systems**: Celery, Redis
- **Validation Engines**: TorchMetrics, PyIQA, Hugging Face Transformers
- **Machine Learning Models**: GPT-2 (Text), DNSMoS (Audio)
- **Database**: PostgreSQL
- **Cloud Infrastructure**: AWS S3 (Storage)


## 🛠️ Installation & Setup

### Clone the repository:

```bash
git clone https://github.com/avishkar1465/NexusStream.git
```

### Install dependencies:

```bash
pip install -r requirements.txt
```

### Run the Flask App:

```bash
python app.py
```
