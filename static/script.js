// function getResponse() {
//     const emotion = document.getElementById("emotionInput").value;
//     let message = "";

//     if (emotion === "anxious") {
//         message = "Take a deep breath. You're well-prepared. Stay calm and focus on the questions one at a time.";
//     } else if (emotion === "confident") {
//         message = "Great! Keep that confidence up and be ready to showcase your skills. But remember to stay humble.";
//     } else if (emotion === "nervous") {
//         message = "It's okay to feel nervous. Try to channel that energy into focus. Remember, nerves can help you stay sharp!";
//     } else if (emotion === "excited") {
//         message = "Your excitement is your strength! Use it to communicate your passion and enthusiasm during the interview.";
//     }

//     document.getElementById("response").innerHTML = "<strong>IntelliVibe says:</strong> " + message;
// }


document.addEventListener("DOMContentLoaded", function () {
    let recognition;
    let isAnalyzing = false;
    let videoStream;
    let currentMode = "facial";
    let camera;
    const socket = io(); // Connect to the server

    // Initialize video feed
    function initVideoFeed() {
        const video = document.getElementById("video");
        if (!video) {
            console.error("Video element not found.");
            return;
        }

        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                video.srcObject = stream;
                videoStream = stream;
                startFacialDetection();
            })
            .catch(error => {
                handleError("Error accessing camera. Please allow camera access.");
                console.error("Camera Error:", error);
            });
    }
    window.onload = function() {
        startVideo();
    };

    // Stop video feed (used when switching to audio mode)
    function stopVideoFeed() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        if (camera) {
            camera.stop();
            camera = null;
        }
    }

    // Facial detection setup
    function startFacialDetection() {
        const video = document.getElementById("video");
        const faceMesh = new FaceMesh({
            locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
            maxFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onFaceMeshResults);

        camera = new Camera(video, {
            onFrame: async () => {
                if (currentMode === "facial") {
                    await faceMesh.send({ image: video });
                }
            },
            width: 640,
            height: 480,
        });

        camera.start();
    }

    // Handle facial mesh result
    function onFaceMeshResults(results) {
        const emotionText = document.getElementById("emotionText");
        if (currentMode !== "facial") return;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const detectedEmotion = "happy"; // Placeholder for facial emotion
            emotionText.textContent = `Detected Facial Emotion: ${detectedEmotion}`;
        } else {
            emotionText.textContent = "No face detected. Please adjust your position.";
        }
    }

    // Voice recognition
    function startVoiceRecognition() {
        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            alert("Speech recognition is not supported in your browser.");
            return;
        }

        if (recognition) recognition.stop(); // Stop previous session if active
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById("chatInput").value = transcript;
            sendMessage();
        };

        recognition.onerror = function (event) {
            handleError(`Speech recognition error: ${event.error}`);
        };

        recognition.onend = function () {
            console.log("Speech recognition ended.");
        };

        recognition.start();
    }

    // Send message and call backend (used only in audio mode)
    function sendMessage() {
        const chatInput = document.getElementById("chatInput");
        const message = chatInput.value.trim();

        if (message === "") {
            handleError("Please enter a message before sending.");
            return;
        }

        if (isAnalyzing) {
            handleError("Emotion analysis in progress. Please wait.");
            return;
        }

        isAnalyzing = true;
        toggleLoadingIndicator(true);
        disableInputs(true);
        updateChatLog("You", message);

        fetch('/analyze_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        })
            .then(response => {
                if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                updateEmotionFeedback(data.emotion, data.feedback);
                updateChatLog("System", `Emotion detected: ${data.emotion} (${data.feedback})`);
            })
            .catch(error => {
                handleError("Error sending message. Try again.");
                console.error("Send Error:", error);
            })
            .finally(() => {
                isAnalyzing = false;
                toggleLoadingIndicator(false);
                disableInputs(false);
                chatInput.value = "";
            });
    }

    // Toggle loading UI
    function toggleLoadingIndicator(isLoading) {
        const loader = document.getElementById("loadingIndicator");
        if (loader) loader.style.display = isLoading ? 'block' : 'none';
    }

    // Disable/Enable input controls
    function disableInputs(disable) {
        const ids = ["chatInput", "sendButton", "recordButton"];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = disable;
        });
    }

    // Chat log display
    function updateChatLog(sender, message) {
        const chatLog = document.getElementById("chat-log");
        if (chatLog) {
            chatLog.innerHTML += `<li><strong>${sender}:</strong> ${message}</li>`;
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    }

    // Error handler
    function handleError(message) {
        alert(message);
        console.error(message);
    }

    // Update emotion feedback display
    function updateEmotionFeedback(emotion, feedback) {
        const emotionText = document.getElementById("emotionText");
        if (emotionText) {
            emotionText.textContent = `Emotion detected: ${emotion} (${feedback})`;
        }
    }

    // Detect emotion via socket
    function detectEmotion() {
        if (isAnalyzing) return;

        const message = document.getElementById("chatInput").value.trim();

        if (currentMode === "audio") {
            if (!message) {
                handleError("Please enter a message for audio detection.");
                return;
            }
            socket.emit("detect_audio_emotion", { message });
        } else {
            socket.emit("detect_facial_emotion");
        }
    }

    // Mode UI updates
    function updateModeUI(activeButtonId) {
        ["facialButton", "audioButton"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove("active");
        });
        const activeBtn = document.getElementById(activeButtonId);
        if (activeBtn) activeBtn.classList.add("active");

        const emotionText = document.getElementById("emotionText");
        if (emotionText) {
            emotionText.textContent = "";
        }
    }

    // Disable facial/audio buttons during transitions
    function disableModeButtons(disable) {
        const buttons = ["facialButton", "audioButton"];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disable;
        });
    }

    // Socket response
    socket.on("emotion_update", (data) => {
        updateEmotionFeedback(data.emotion, data.feedback);
    });

    // Button listeners
    const sendBtn = document.getElementById("sendButton");
    if (sendBtn) {
        sendBtn.addEventListener("click", () => {
            if (currentMode === "audio") {
                sendMessage();
            } else {
                detectEmotion();
            }
        });
    }

    const recordBtn = document.getElementById("recordButton");
    if (recordBtn) {
        recordBtn.addEventListener("click", startVoiceRecognition);
    }

    const facialBtn = document.getElementById("facialButton");
    if (facialBtn) {
        facialBtn.addEventListener("click", () => {
            currentMode = "facial";
            updateModeUI("facialButton");
            const emotionText = document.getElementById("emotionText");
            if (emotionText) emotionText.textContent = "Switched to Facial Emotion Detection";

            disableModeButtons(true);
            setTimeout(() => {
                disableModeButtons(false);
                stopVideoFeed(); // Stop any existing stream
                initVideoFeed(); // Restart clean video feed
            }, 1000);
        });
    }

    const audioBtn = document.getElementById("audioButton");
    if (audioBtn) {
        audioBtn.addEventListener("click", () => {
            currentMode = "audio";
            updateModeUI("audioButton");
            const emotionText = document.getElementById("emotionText");
            if (emotionText) emotionText.textContent = "Switched to Audio Emotion Detection";

            disableModeButtons(true);
            setTimeout(() => {
                disableModeButtons(false);
                stopVideoFeed(); // Stop camera when switching to audio
            }, 1000);
        });
    }

    // Initialize on load
    initVideoFeed();

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
        stopVideoFeed();
        if (recognition) recognition.stop();
    });
});





