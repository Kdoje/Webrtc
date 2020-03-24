'use strict';
// click send on the initiator, then the other page to get messages flowing
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
let sendChannel;
var pc;
let txtMsgToSend = document.getElementById("txtMsgToSend");
let msgHistory = document.getElementById("msgHistory");
let btnSend = document.getElementById("btnSend");
/////////////////////////////////////////////

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io('https://kdoje-sockets.glitch.me').connect();
//socket.connect('https://kdoje-sockets.glitch.me', { autoConnect: true});

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
});

socket.on('joined', function (room) {
  console.log('joined: ' + room);
});

socket.on('ready', function (room) {
  console.log("peers are ready");
  isChannelReady = true;
  attachToRoom();
});

socket.on('log', function (array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function (message) {
  if (message.type === 'offer') {
    if (!isStarted) {
      attachToRoom();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

function attachToRoom() {
  if (!isStarted && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      createOffer();
    }
    else{
      pc.ondatachannel = recieveChannelCallback;
    }
  }
}

btnSend.onclick= ()=>{
  console.log("sending Message");
  sendChannel.send(txtMsgToSend.value);
  txtMsgToSend.value = "";
};
function recieveChannelCallback(event){
  console.log("attached to channel");
  sendChannel = event.channel;
  sendChannel.onmessage = onRecieveMessage;
}

function onRecieveMessage(event){
  console.log("recieved message "+ event.data);
}

window.onbeforeunload = function () {
  hangup();
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    isStarted = true;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function createOffer() {
  sendChannel = pc.createDataChannel('sendDataChannel');
  sendChannel.onmessage = onRecieveMessage;
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
  console.log("connected to channel");
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
