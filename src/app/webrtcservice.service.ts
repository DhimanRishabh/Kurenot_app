import { Injectable } from '@angular/core';
import {IN_CALL, NO_CALL, NOT_REGISTERED, PROCESSING_CALL, REGISTERED, REGISTERING} from './appconstants';
import {WebRtcPeer} from 'kurento-utils';



@Injectable()
export class WebrtcserviceService {
  ws: any
  disableButtonCall = false;
  disableButtonTerminate = false;
  disableButtonRegister = false;
  webRtcPeer;
  response;
  callerMessage;
  from;
  nameid;
  peerid;
  registerName = null;
  registerState = null;
  videoInput;
  videoOutput;
  NOT_REGISTERED = 0;
  REGISTERING = 1;
  REGISTERED = 2;

  callState = null;
  NO_CALL = 0;
  PROCESSING_CALL = 1;
  IN_CALL = 2;



  constructor() { }

  setWebSocket(ws){
    this.ws = ws;
  }
  getWebSocket(){
    return this.ws;
  }


  registerResponse(message) {
    if (message.response === 'accepted') {
      this.setRegisterState(REGISTERED);
    } else {
      this.setRegisterState(NOT_REGISTERED);
      const errorMessage = message.message ? message.message
        : 'Unknown reason for register rejection.';
      console.log(errorMessage);
      alert('Error registering user. See console for further information.');
    }
  }
  callResponse(message) {
    if (message.response !== 'accepted') {
      console.log('Call not accepted by peer. Closing call');
      const errorMessage = message.message ? message.message
        : 'Unknown reason for call rejection.';
      console.log(errorMessage);
      // @ts-ignore
      stop();
    } else {
      this.setCallState(IN_CALL);
      this.processAnswerl(message);
    }
  }
  incomingCall(message) {
    // If bussy just reject without disturbing user
    if (this.callState !== NO_CALL) {
      let response = {
        id : 'incomingCallResponse',
        from : message.from,
        callResponse : 'reject',
        message : 'bussy'
      };
      return this.sendMessage(response);
    }

    this.setCallState(PROCESSING_CALL);
    if (confirm('User ' + message.from
      + ' is calling you. Do you accept the call?')) {

      this.from = message.from;
      let options = {
        localVideo : this.videoInput,
        remoteVideo : this.videoOutput,
        onicecandidate : this.onIceCandidate.bind(this),
        onerror : this.onError.bind(this)
      }
      this.webRtcPeer = WebRtcPeer.WebRtcPeerSendrecv(options,
        error => {
          if (error) {
            return console.log(error);
          }
          this.webRtcPeer.generateOffer(this.onOfferIncomingCall.bind(this));
        });

    } else {
      let response = {
        id : 'incomingCallResponse',
        from : message.from,
        callResponse : 'reject',
        message : 'user declined'
      };
      this.sendMessage(response);
      // @ts-ignore
      stop();
    }
  }

  startCommunication(message) {
    this.setCallState(IN_CALL);
    this.processAnswerl(message);
  }
  processAnswerl(message){
    this.webRtcPeer.processAnswer(message.sdpAnswer, error => {
      if (error) {
        return console.log(error);
      }
    });
  }
  addIceCandidatel(message){
    this.webRtcPeer.addIceCandidate(message.candidate, error => {
      if (error) {
        return console.log('Error adding candidate: ' + error);
      }
    });
  }


  register() {
    let name = this.nameid.value;
    if (name === '') {
      window.alert('You must insert your user name');
      return;
    }
    this.setRegisterState(REGISTERING);

    let message = {
      id : 'register',
      name : name
    };
    this.sendMessage(message);
  }
  call() {
    if (this.peerid.value === '') {
      window.alert('You must specify the peer name');
      return;
    }
    this.setCallState(PROCESSING_CALL);


    let options = {
      localVideo : this.videoInput,
      remoteVideo : this.videoOutput,
      onicecandidate : this.onIceCandidate.bind(this),
      onerror : this.onError.bind(this)
    }
    this.webRtcPeer = WebRtcPeer.WebRtcPeerSendrecv(options,
      error => {
        if (error) {
          return console.log(error);
        }
        this.webRtcPeer.generateOffer(this.onOfferCall.bind(this));
      });
  }
  onOfferCall(error, offerSdp) {
    if (error) {
      return console.error('Error generating the offer');
    }
    console.log('Invoking SDP offer callback function');
    let message = {
      id : 'call',
      from : this.nameid.value,
      to : this.peerid.value,
      sdpOffer : offerSdp
    };
    this.sendMessage(message);
  }
  setVideoInput(videoInput: HTMLElement){
    this.videoInput = videoInput;
  }
  setVideoOutput(videoOutput: HTMLElement){
    this.videoOutput = videoOutput;
  }
  setNameId(nameId: HTMLElement){
    this.nameid = nameId;
  }

  setPeerId(peerid: HTMLElement){
    this.peerid = peerid;
  }

  onOfferIncomingCall(error, offerSdp) {
    if (error)
      return console.log('Error generating the offer');
    // tslint:disable-next-line:no-shadowed-variable
    let response = {
      id : 'incomingCallResponse',
      from : this.from,
      callResponse : 'accept',
      sdpOffer : offerSdp
    };
    this.sendMessage(response);
  }


  setRegisterState(nextState) {

    switch (nextState) {
      case NOT_REGISTERED:
        this.disableButtonCall = false;
        localStorage.setItem('disableButtonCall', 'false');
        this.setCallState(NO_CALL);
        break;
      case REGISTERING:
        localStorage.setItem('disableButtonRegister', 'true');
        this.disableButtonRegister = true;
        break;
      case REGISTERED:
        localStorage.setItem('disableButtonRegister', 'true');
        this.disableButtonRegister = true;
        this.setCallState(NO_CALL);
        break;
      default:
        return;
    }
    this.registerState = nextState;
  }

  setCallState(nextState) {
    switch (nextState) {
      case NO_CALL:
        localStorage.setItem('disableButtonCall', 'true');
        localStorage.setItem('disableButtonTerminate', 'false');
        this.disableButtonCall = true;
        this.disableButtonTerminate = false;
        // this.disableButton(this.play);
        break;
      case PROCESSING_CALL:
        localStorage.setItem('disableButtonCall', 'true');
        localStorage.setItem('disableButtonTerminate', 'true');
        this.disableButtonCall = true;
        this.disableButtonTerminate = true;
        // this.disableButton(this.play);
        break;
      case IN_CALL:
        localStorage.setItem('disableButtonCall', 'false');
        localStorage.setItem('disableButtonTerminate', 'true');
        this.disableButtonCall = false;
        this.disableButtonTerminate = true;
        // this.disableButton(this.play);
        break;
      default:
        return;
    }
    this.callState = nextState;
  }





  sendMessage(message) {
    const jsonMessage = JSON.stringify(message);
    console.log('Sending message: ' + jsonMessage);
    this.ws.send(jsonMessage);
  }

   onIceCandidate(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));

    let message = {
      id : 'onIceCandidate',
      candidate : candidate
    };
    this.sendMessage(message);
  }


  stop(message) {
    this.setCallState(NO_CALL);
    if (this.webRtcPeer) {
      this.webRtcPeer.dispose();
      this.webRtcPeer = null;

      if (!message) {
        let message = {
          id : 'stop'
        }
        this.sendMessage(message);
      }
    }

  }

 onError() {
    this.setCallState(NO_CALL);
  }





}
