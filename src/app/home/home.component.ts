import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {WebrtcserviceService} from '../webrtcservice.service';
import {WebRtcPeer} from 'kurento-utils';
import {passBoolean} from 'protractor/built/util';
import {Subject} from 'rxjs';

let ws = new WebSocket('wss://' + location.host + '/call');
let disableButtonCall =false;
let disableButtonTerminate =false;
let disableButtonRegister = false;
let webRtcPeer;
let response;
let callerMessage;
let from;
let nameid;
let peerid;
let registerName = null;
let registerState = null;
let videoInput;
let videoOutput;
const NOT_REGISTERED = 0;
const REGISTERING = 1;
const REGISTERED = 2;

function setRegisterState(nextState) {

  switch (nextState) {
    case NOT_REGISTERED:
      disableButtonCall = false;
      localStorage.setItem('disableButtonCall', 'false');
      setCallState(NO_CALL);
      break;
    case REGISTERING:
      localStorage.setItem('disableButtonRegister', 'true');
      disableButtonRegister = true;
      break;
    case REGISTERED:
      localStorage.setItem('disableButtonRegister', 'true');
      disableButtonRegister = true;
      setCallState(NO_CALL);
      break;
    default:
      return;
  }
  registerState = nextState;
}

let callState = null;
const NO_CALL = 0;
const PROCESSING_CALL = 1;
const IN_CALL = 2;

function setCallState(nextState) {
  switch (nextState) {
    case NO_CALL:
      localStorage.setItem('disableButtonCall', 'true');
      localStorage.setItem('disableButtonTerminate', 'false');
      disableButtonCall = true;
      disableButtonTerminate = false;
      // this.disableButton(this.play);
      break;
    case PROCESSING_CALL:
      localStorage.setItem('disableButtonCall', 'true');
      localStorage.setItem('disableButtonTerminate', 'true');
      disableButtonCall = true;
      disableButtonTerminate = true;
      // this.disableButton(this.play);
      break;
    case IN_CALL:
      localStorage.setItem('disableButtonCall', 'false');
      localStorage.setItem('disableButtonTerminate', 'true');
      disableButtonCall = false;
      disableButtonTerminate = true;
      // this.disableButton(this.play);
      break;
    default:
      return;
  }
  callState = nextState;
}

// tslint:disable-next-line:only-arrow-functions
window.onload = function() {
  setRegisterState(NOT_REGISTERED);
  document.getElementById('name').focus();
}

window.onbeforeunload = () => {
  ws.close();
}

ws.onmessage = message => {
  const parsedMessage = JSON.parse(message.data);
  console.log('Received message: ' + message.data);

  switch (parsedMessage.id) {
    case 'registerResponse':
      registerResponse(parsedMessage);
      break;
    case 'callResponse':
      callResponse(parsedMessage);
      break;
    case 'incomingCall':
      incomingCall(parsedMessage);
      break;
    case 'startCommunication':
      startCommunication(parsedMessage);
      break;
    case 'stopCommunication':
      console.log('Communication ended by remote peer');
      stop(true);
      break;
    case 'iceCandidate':
      webRtcPeer.addIceCandidate(parsedMessage.candidate, error => {
        if (error) {
          return console.log('Error adding candidate: ' + error);
        }
      });
      break;
    default:
      console.log('Unrecognized message', parsedMessage);
  }
}

function registerResponse(message) {
  if (message.response === 'accepted') {
    setRegisterState(REGISTERED);
  } else {
    setRegisterState(NOT_REGISTERED);
    const errorMessage = message.message ? message.message
      : 'Unknown reason for register rejection.';
    console.log(errorMessage);
    alert('Error registering user. See console for further information.');
  }
}

function callResponse(message) {
  if (message.response !== 'accepted') {
    console.log('Call not accepted by peer. Closing call');
    const errorMessage = message.message ? message.message
      : 'Unknown reason for call rejection.';
    console.log(errorMessage);
    // @ts-ignore
    stop();
  } else {
    setCallState(IN_CALL);
    webRtcPeer.processAnswer(message.sdpAnswer, error => {
      if (error) {
        return console.log(error);
      }
    });
  }
}

function startCommunication(message) {
  setCallState(IN_CALL);
  webRtcPeer.processAnswer(message.sdpAnswer, error => {
    if (error) {
      return console.log(error);
    }
  });
}

function incomingCall(message) {
  // If bussy just reject without disturbing user
  if (callState !== NO_CALL) {
    let response = {
      id : 'incomingCallResponse',
      from : message.from,
      callResponse : 'reject',
      message : 'bussy'
    };
    return sendMessage(response);
  }

  setCallState(PROCESSING_CALL);
  if (confirm('User ' + message.from
    + ' is calling you. Do you accept the call?')) {

    from = message.from;
    let options = {
      localVideo : videoInput,
      remoteVideo :videoOutput,
      onicecandidate : onIceCandidate,
      onerror : onError
    }
    webRtcPeer = WebRtcPeer.WebRtcPeerSendrecv(options,
      error => {
        if (error) {
          return console.log(error);
        }
        webRtcPeer.generateOffer(onOfferIncomingCall);
      });

  } else {
    let response = {
      id : 'incomingCallResponse',
      from : message.from,
      callResponse : 'reject',
      message : 'user declined'
    };
    sendMessage(response);
    // @ts-ignore
    stop();
  }
}

function onOfferIncomingCall(error, offerSdp) {
  if (error)
    return console.log('Error generating the offer');
  // tslint:disable-next-line:no-shadowed-variable
  let response = {
    id : 'incomingCallResponse',
    from : from,
    callResponse : 'accept',
    sdpOffer : offerSdp
  };
  sendMessage(response);
}

function register() {
  let name = nameid.value;
  if (name === '') {
    window.alert('You must insert your user name');
    return;
  }
  setRegisterState(REGISTERING);

  let message = {
    id : 'register',
    name : name
  };
  sendMessage(message);
  document.getElementById('peer').focus();
}

function call() {
  if (peerid.value === '') {
    window.alert('You must specify the peer name');
    return;
  }
  setCallState(PROCESSING_CALL);


  let options = {
    localVideo : videoInput,
    remoteVideo : videoOutput,
    onicecandidate : onIceCandidate,
    onerror : onError
  }
  webRtcPeer = WebRtcPeer.WebRtcPeerSendrecv(options,
    error => {
      if (error) {
        return console.log(error);
      }
      webRtcPeer.generateOffer(onOfferCall);
    });
}

function onOfferCall(error, offerSdp) {
  if (error) {
    return console.error('Error generating the offer');
  }
  console.log('Invoking SDP offer callback function');
  let message = {
    id : 'call',
    from : nameid.value,
    to : peerid.value,
    sdpOffer : offerSdp
  };
  sendMessage(message);
}

function stop(message) {
  setCallState(NO_CALL);
  if (webRtcPeer) {
    webRtcPeer.dispose();
    webRtcPeer = null;

    if (!message) {
      let message = {
        id : 'stop'
      }
      sendMessage(message);
    }
  }

}

function onError() {
  setCallState(NO_CALL);
}

function onIceCandidate(candidate) {
  console.log('Local candidate' + JSON.stringify(candidate));

  let message = {
    id : 'onIceCandidate',
    candidate : candidate
  };
  sendMessage(message);
}

function sendMessage(message) {
  let jsonMessage = JSON.stringify(message);
  console.log('Sending message: ' + jsonMessage);
  ws.send(jsonMessage);
}





/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit , OnDestroy {
  disableButtonCall1 =false;
  disableButtonTerminate1=false;
  disableButtonRegister1 = false;
  disableButtonCallsubject = new Subject();
  disableButtonTerminatesubject = new Subject();
  disableButtonRegistersubject = new Subject();


  enableButtonCall = false;

  constructor(private webrtcserviceService: WebrtcserviceService) {
  }

  @ViewChild('register',{ static: true }) registerid: ElementRef;
  @ViewChild('call',{ static: true }) callid: ElementRef;
  @ViewChild('terminate',{ static: true }) terminateid: ElementRef;
  @ViewChild('play',{ static: true }) playid: ElementRef;
  @ViewChild('name',{ static: true }) nameid: ElementRef;
  @ViewChild('peer',{ static: true }) peerid: ElementRef;
  @ViewChild('videoInput',{ static: true }) videoInput: ElementRef;
  @ViewChild('videoOutput',{ static: true }) videoOutput: ElementRef;

  ngOnInit(): void {
    videoInput = this.videoInput.nativeElement;
    videoOutput = this.videoOutput.nativeElement;
    nameid = this.nameid.nativeElement;
    peerid = this.peerid.nativeElement;
  }


  ngOnDestroy(): void {
   }
  callFn(){
    call();
    this.updateButton();
  }

  stop(b: boolean) {
    stop(b);
    this.updateButton();
  }

  registerFN() {
    register();
    this.updateButton();
  }

  updateButton(){
    this.disableButtonCall1 = Boolean(localStorage.getItem('disableButtonCall'));
    this.disableButtonTerminate1 = Boolean(localStorage.getItem('disableButtonTerminate'));
    this.disableButtonRegister1 = Boolean(localStorage.getItem('disableButtonRegister'));
  }
}
