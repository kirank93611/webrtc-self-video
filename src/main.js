import './style.css'
import firebase from firebase/app

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCSmy5LHuqG0s7DlatqiFjUPEJd8Ezx7E",
  authDomain: "fireship-webrtc-82583.firebaseapp.com",
  projectId: "fireship-webrtc-82583",
  storageBucket: "fireship-webrtc-82583.firebasestorage.app",
  messagingSenderId: "1004296147447",
  appId: "1:1004296147447:web:aad95575a83d12cfee5ef2"
};

if(!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)
}

const firestore=firebase.firestore();

const servers={
  iceServers:[
    {
      urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize:10,
}

//Global State
const pc=new RTCPeerConnection(servers);
let localStream=null;
let remoteStream=null;

//HTML elements
const webcamButton=document.getElementsById('webcamButton');
const webcamVideo=document.getElementById('webcamVideo');
const callButton=document.getElementById('callButton')
const callInput=document.getElementById('callInput');
const answerButton=document.getElementById('answerButton');
const remoteVideo=document.getElementById('remoteVideo');
const hangupButton=document.getElementById('hangupButton');


//1.setup media sources

webcamButton.onclick=async () =>{
  localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  remoteStream=await MediaStream();


//Push tracks from local stream to peer connection
localStream.getTracks().forEach((track)=>{
  pc.addTrack(track,localStream);
});

//pull tracks from remote stream, add to video stream
pc.ontrack=(event) =>{
  event.streams[0].getTracks().forEach((track)=>{
    remoteStream.addTrack(track);
  });
};

webcamVideo.srcObject=localStream;
remoteVideo.srcObject=remoteStream;

callButton.disabled=false;
answerButton.disabled=false;
webcamButton.disabled=true;
};

//2. Create an offer
callButton.onclick=async () => {
  //Reference Firestore collection for signaling
  const callDoc =firestore.collection('calls').doc();
  const offerCandidates=callDoc.collection('offerCandidates');
  const answerCandidates=callDoc.collection('answerCandidates');

  callInput.value=callDoc.id;

  //Get Candidates for caller, save to db
  pc.onicecandidate=(event) =>{
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  //Create offer
  const offerDescription=await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer={
    sdp:offerDescription.sdp,
    type:offerDescription.type,
  };

  await callDoc.set({offer});

  //Listen for remote answer
  callDoc.onSnapshot((snapshot)=>{
    const data=snapshot.data();
    if(!pc.currentRemoteDescription && data?.answer) {
      const answerDescription=new RTCSessoinDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
}

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);