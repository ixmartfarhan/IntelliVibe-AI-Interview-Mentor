# 🧠 IntelliVibe: The Emotionally Aware Interview Mentor

**IntelliVibe** is an advanced AI-powered interview preparation tool that detects human emotions through both **facial expressions** and **voice tone** to provide real-time feedback. Designed for candidates preparing for job interviews, it helps boost emotional awareness and communication skills.

---

## 🚀 Features

- 🎥 **Facial Emotion Detection** via webcam (using MediaPipe + custom-trained CNN model)
- 🎙️ **Voice Emotion Recognition** (Wav2Vec2 model with Hugging Face Transformers)
- 📢 **Real-Time Feedback** using Text-to-Speech (TTS)
- 🗣️ **Voice Interaction** to simulate mock interviews
- 💬 Smart chat interface with auto-scroll and voice-to-text
- 🔄 Switch between Facial and Audio detection modes
- 🌐 Web-based interface (HTML, CSS, JavaScript) + Flask backend

---

## 🛠️ Tech Stack

| Frontend             | Backend           | AI/ML Models              |
|----------------------|-------------------|---------------------------|
| HTML5, CSS3, JS      | Python (Flask)    | CNN (Facial Emotion)      |
| Bootstrap            | REST API          | Wav2Vec2 (Audio Emotion)  |
| Web Speech API       | Text-to-Speech    | MediaPipe Face Mesh       |

---

## 📦 Dataset

A custom dataset of **30,000+ images** was used to train the facial emotion recognition model.

📁 Download Dataset: [Google Drive Link](https://drive.google.com/your-dataset-link-here)

> The dataset includes images labeled for emotions such as *happy, sad, angry, neutral, surprised,* and more.

---

## 📂 Repository Structure

```bash
IntelliVibe-AI-Interview-Mentor/
│
├── static/
│   └── script.js              # Frontend logic for interaction
│
├── templates/
│   └── index.html             # Main UI interface
│
├── model/
│   └── emotion_model.h5       # Trained CNN model (Facial)
│
├── app.py                     # Flask backend with routes and detection logic
├── requirements.txt           # Python dependencies
├── README.md                  # You're reading it!
