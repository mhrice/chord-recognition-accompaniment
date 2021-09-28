import logo from './logo.svg';
import './App.css';
import { io } from "socket.io-client";
import React, { useState, useEffect } from 'react'

let audioContext = null;
let audioBufferNode = null;
let audioInput = null
let mediaRecorder = null;
let localPeerConnection = null;
let remotePeerConnection = null;
let interval = null;
let audioChunks = []
let isRecording = true;
let audioPlayer;
// import soundfile from "6c9b2879564843f985924f85f952b69f.wav"


function App() {
  const [socket, setSocket] = useState(null);
  const [recording, setRecording] = useState(false)
  const [audioStarted, setAudioStarted] = useState(false)
  const [chord, setChord] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState({})
  const [audioUrl, setAudioUrl] = useState("")
  const [audioText, setAudioText] = useState("Play Recording")


  useEffect(() => {
    // const newSocket = io(`http://${window.location.hostname}:3001`);
    const newSocket = io("localhost:5000");

    console.log("CONNECTED")
    newSocket.on("response", handleChordProcess)
    setSocket(newSocket);
    return () => newSocket.close();
  }, [setSocket]);


  useEffect(()=>{
    // window.AudioContext = window.AudioContext || window.webkitAudioContext;
    // audioContext = new AudioContext({sampleRate: 22050});
    // const getWorklet = async () => {
    //   await audioContext.audioWorklet.addModule('audio-buffer.js')
    //   audioBufferNode = new AudioWorkletNode(audioContext, 'audio-buffer')
    // }
    // getWorklet()

  }, [])

  const sendMessage = () => {
    if(socket){
      if (!audioStarted){
        startAudio()
      }
      if(!recording){
        console.log("Starting Recording")
        socket.emit('start-recording', { numChannels: 1, bps: 16, fps: parseInt(audioContext.sampleRate) });
      }
      else {
        console.log("Ending Recording")
        // socket.emit('end-recording', {});



      }
      
      
      setRecording(!recording)
    }
  }

  async function getWorklet(){
    await audioContext.audioWorklet.addModule('audio-buffer.js')
    audioBufferNode = new window.AudioWorkletNode(audioContext, 'audio-buffer')
  }
  function startAudio(){
    audioContext = new AudioContext({ sampleRate: 22050 });
    console.log("HI")
    // getWorklet()
    console.log("BYe")

    // audioContext.resume()
    if (!navigator.getUserMedia)
      navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!navigator.cancelAnimationFrame)
      navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
    if (!navigator.requestAnimationFrame)
      navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia({ audio: true }, gotStream, function (e) {
      alert('Error getting audio');
      setRecording(false)
      console.log(e);
    });
  }


  function gotStream(stream) {
    setAudioStarted(true);
    // Create an AudioNode from the stream.
    let realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = convertToMono(realAudioInput);
    let options = {}

    const scriptNode = audioContext.createScriptProcessor(1024, 1, 1);

    scriptNode.onaudioprocess = function (audioEvent) {
        let input = audioEvent.inputBuffer.getChannelData(0);
        if(isRecording){
          setStatus("Recording...")

        console.log("WRITE")
        // convert float audio data to 16-bit PCM
        var buffer = new ArrayBuffer(input.length * 2)
        var output = new DataView(buffer);
        for (var i = 0, offset = 0; i < input.length; i++, offset += 2) {
          var s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        socket.emit('write-audio', buffer);
      }
    }
      audioInput.connect(scriptNode);
      scriptNode.connect(audioContext.destination)
      
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.onstop = function (e) {
        console.log("data available after MediaRecorder.stop() called.");

        var audio = document.createElement('audio');
        audio.controls = true;
        var blob = new Blob(audioChunks, { 'type': 'audio/ogg; codecs=opus' });
        let newAudioUrl = window.URL.createObjectURL(blob);
        setAudioUrl(newAudioUrl)
        audioChunks = []
        console.log("recorder stopped");
      }

      mediaRecorder.ondataavailable = function (e) {
        audioChunks.push(e.data);
      }
      mediaRecorder.start();
      
      setTimeout(()=>{
        console.log("stopping recording")
        isRecording = false;
        setStatus("Processing...")
        socket.emit('end-recording');
        mediaRecorder.stop();
        // audio.src = audioURL;

        // setAudioSrc(audioURL);
      }, 12000)

    // let scriptNode = audioContext.createJavaScriptNode.call(audioContext, 1024, 1, 1);
    // scriptNode.onaudioprocess = function (audioEvent) {
      // if (recording) {
        // let input = audioEvent.inputBuffer.getChannelData(0);

        // convert float audio data to 16-bit PCM
        // var buffer = new ArrayBuffer(input.length * 2)
        // var output = new DataView(buffer);
        // for (var i = 0, offset = 0; i < input.length; i++, offset += 2) {
        //   var s = Math.max(-1, Math.min(1, input[i]));
        //   output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        // }
    // audioInput.connect(audioBufferNode)
    // socket.emit('write-audio', audioInput);
    //   // }
    // interval = setInterval(()=>{
    //   mediaRecorder.requestData()
    // }, 10000)
    // updateAnalysers();
  }
 
  function convertToMono(input) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);
    return merger;
  }

  const handleChordProcess = (message) =>{
    let chords = JSON.parse(message)
    let chordChanges = []
    let chordNames = []
    chords.forEach(chordData=>{
        let chordString = chordData.replace("\n", "").split(" ");
        chordChanges.push(chordString[0]);
        chordNames.push(chordString[2]);
    })
    console.log(chordChanges, chordNames)
    setData({ "chordChanges": chordChanges, "chordNames": chordNames})
    setStatus("Done Processing.")

  }


  const playAudio = () =>{
    if(audioText!="Pause"){
      audioPlayer = new Audio(audioUrl);
      audioPlayer.addEventListener("ended", playerEnded);
      audioPlayer.play();
      setAudioText("Pause")
      data["chordNames"].forEach((chordNames, idx) =>{
        setTimeout(()=>{
          setChord(chordNames)
        }, data["chordChanges"][idx] * 1000);
      })
    } else {
      setAudioText("Play");
      audioPlayer.stop();
      setChord("")


  }

  }

  const playerEnded = () => {
    setAudioText("Play");
    setChord("")
  }

  return (
    <div className="App">
      <button onClick={sendMessage}>{recording ? "Stop Recording" : "Click to Record Audio"}</button>
      <br/>
      {status}
      <br/>
      {status === "Done Processing." &&
        <button onClick={playAudio}>{audioText}</button>
      }<br/>
      {/* <audio src={audioSrc} /> */}
      {chord}

    </div>
  );
}






export default App;





