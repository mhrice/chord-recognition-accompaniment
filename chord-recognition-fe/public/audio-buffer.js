const socket
class AudioBuffer extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
                console.log("HI")
                return true;
        }
        onmessage(event) { }
                socket = event.socket
        }
}
registerProcessor('audio-buffer', AudioBuffer)
