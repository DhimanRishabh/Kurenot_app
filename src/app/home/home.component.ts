import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {WebrtcserviceService} from '../webrtcservice.service';
import {NOT_REGISTERED, REGISTERED, REGISTERING} from '../appconstants';
import {WebRtcPeer} from 'kurento-utils';




@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit , OnDestroy , AfterViewInit{

  constructor() { }
  @ViewChild('register') register: ElementRef;
  @ViewChild('call') call: ElementRef;
  @ViewChild('terminate') terminate: ElementRef;
  @ViewChild('play') play: ElementRef;
  @ViewChild('name') nameid: ElementRef;
  @ViewChild('peer') peerid: ElementRef;
  @ViewChild('videoInput') videoInput: ElementRef;
  @ViewChild('videoOutput') videoOutput: ElementRef;
  disableButtonCall: boolean;
  disableButtonTerminate: boolean;
  private jsonMessage: string;
  private message;
  name: string;
  ws: any;
  NOT_REGISTERED = 0;
  registerState = null;
  NO_CALL = 0;
  callState = null;
  PROCESSING_CALL = 1;
  IN_CALL = 2;
  disableButtonRegister = false;
  enableButtonCall = false;
  parsedMessage;
  errorMessage: any;
  response: any;
  options: any;
  from: any;
  webRtcPeer: any;
  ngOnInit(): void {

  }
  ngOnDestroy(): void {
    this.ws.close();
  }
  startCommunication(message) {
    this.setCallState(this.IN_CALL);
    this.webRtcPeer.processAnswer(message.sdpAnswer, error => {
      if (error) {
        return console.error(error);
      }
    });
  }

  setRegisterState(nextState: number) {
    switch (nextState) {
      case NOT_REGISTERED:
        this.disableButtonRegister = false;
        this.setCallState(this.NO_CALL);
        break;
      case REGISTERING:
        this.disableButtonRegister = true;
        break;
      case REGISTERED:
        this.disableButtonRegister = true;
        this.setCallState(this.NO_CALL);
        break;
      default:
        return;
    }
    this.registerState = nextState;
  }

  setCallState(nextState) {
    switch (nextState) {
      case this.NO_CALL:
        this.disableButtonCall = true;
        this.disableButtonTerminate = false;
        // this.disableButton(this.play);
        break;
      case this.PROCESSING_CALL:
        this.disableButtonCall = true;
        this.disableButtonTerminate = true;
        // this.disableButton(this.play);
        break;
      case this.IN_CALL:
        this.disableButtonCall = false;
        this.disableButtonTerminate = true;
        // this.disableButton(this.play);
        break;
      default:
        return;
    }
    this.callState = nextState;
  }



  ngAfterViewInit(): void {
    this.ws = new WebSocket('wss://' + location.host + '/call');
    this.ws.onmessage = message => {
      this.parsedMessage = JSON.parse(message.data);
      console.log('Received message: ' + message.data);
      switch (this.parsedMessage.id) {
        case 'registerResponse':
          this.registerResponse(this.parsedMessage);
          break;
        case 'callResponse':
          this.callResponse(this.parsedMessage);
          break;
        case 'incomingCall':
          this.incomingCall(this.parsedMessage);
          break;
        case 'startCommunication':
          this.startCommunication(this.parsedMessage);
          break;
        case 'stopCommunication':
          console.log('Communication ended by remote peer');
          this.stop(true);
          break;
        case 'iceCandidate':
          this.webRtcPeer.addIceCandidate(this.parsedMessage.candidate, error => {
            if (error) {
              return console.error('Error adding candidate: ' + error);
            }
          });
          break;
        default:
          console.error('Unrecognized message', this.parsedMessage);
      }

    };
    console.log(this.register);
    this.setRegisterState(NOT_REGISTERED);
  }
  registerResponse(message) {

    if (message.response === 'accepted') {
     this. setRegisterState(REGISTERED);
    } else {
     this. setRegisterState(NOT_REGISTERED);
     this.errorMessage = message.message ? message.message
        : 'Unknown reason for register rejection.';
     console.log(this.errorMessage);
     alert('Error registering user. See console for further information.');
    }
  }
  callResponse(message) {
    if (message.response !== 'accepted') {
      console.log('Call not accepted by peer. Closing call');
      this.errorMessage = message.message ? message.message
        : 'Unknown reason for call rejection.';
      console.log(this.errorMessage);
      this.stop(false);
    } else {
      this.setCallState(this.IN_CALL);
      this.webRtcPeer.processAnswer(message.sdpAnswer, error => {
        if (error) {
          return console.error(error);
        }
      });
    }
  }
  incomingCall(message) {
    // If bussy just reject without disturbing user
    if (this.callState !== this.NO_CALL) {
       this.response = {
        id : 'incomingCallResponse',
        from : message.from,
        callResponse : 'reject',
        message : 'bussy'
      };
       return this.sendMessage(this.response);
    }

    this.setCallState(this.PROCESSING_CALL);
    if (confirm('User ' + message.from
      + ' is calling you. Do you accept the call?')) {
      /*this.showSpinner(videoInput, videoOutput);
*/
      this.options = {
        localVideo : this.videoInput.nativeElement,
        remoteVideo : this.videoOutput.nativeElement,
        onicecandidate : (candidate) => {
        console.log('Local candidate' + JSON.stringify(candidate));
        this.message = {
          id : 'onIceCandidate',
          candidate : candidate
        };
        this.sendMessage(this.message);
      },
        onerror : () => {
          this.setCallState(this.NO_CALL);
    }
      };


      this.webRtcPeer = WebRtcPeer.WebRtcPeerSendrecv( this.options,
         error => {
           if (error) {
            return console.error(error);
           }
         });
      this.webRtcPeer.generateOffer((error, offerSdp) => {
        if (error) {
          return console.error('Error generating the offer');
        }
        this.response = {
          id : 'incomingCallResponse',
          from : message.from,
          callResponse : 'accept',
          sdpOffer : offerSdp
        };
        this.sendMessage(this.response);
      });
    } else {
      this.response = {
        id : 'incomingCallResponse',
        from : message.from,
        callResponse : 'reject',
        message : 'user declined'
      };
      this.sendMessage(this.response);
      this.stop(false);
    }
  }

  callFN() {
    if (this.peerid.nativeElement.value === '') {
      window.alert('You must specify the peer name');
      return;
    }
    this.setCallState(this.PROCESSING_CALL);

    this.options = {
      localVideo : this.videoInput.nativeElement,
      remoteVideo : this.videoOutput.nativeElement,
      onicecandidate : (candidate) => {
      console.log('Local candidate' + JSON.stringify(candidate));

      this.message = {
        id : 'onIceCandidate',
        candidate : candidate
      };
      this.sendMessage(this.message);
    },
      onerror : () => {
      this.setCallState(this.NO_CALL);
    }
    }
    // @ts-ignore
    this.webRtcPeer =  new WebRtcPeer.WebRtcPeerSendrecv( this.options,
      error => {
        if (error) {
          return console.log(error);
        }
      });
    this.webRtcPeer.generateOffer((error, offerSdp) => {
      if (error) {
        return console.error('Error generating the offer');
      }
      console.log('Invoking SDP offer callback function');
      this.message = {
        id : 'call',
        from : this.nameid.nativeElement.value,
        to : this.peerid.nativeElement.value,
        sdpOffer : offerSdp
      };
      this.sendMessage(this.message);
    });
  }


  /*onOfferCall(error, offerSdp) {
    if (error) {
      return console.error('Error generating the offer');
    }
    console.log('Invoking SDP offer callback function');
    this.message = {
      id : 'call',
      from : this.nameid.nativeElement.value,
      to : this.peerid.nativeElement.value,
      sdpOffer : offerSdp
    };
    this.sendMessage(this.message);
  }*/
  stop(message) {
    this.setCallState(this.NO_CALL);
    if (this.webRtcPeer) {
      this.webRtcPeer.dispose();
      this.webRtcPeer = null;

      if (!message) {
        this.message = {
          id : 'stop'
        };
        this.sendMessage(this.message);
      }
    }
    // hideSpinner(videoInput, videoOutput);
  }


 /* onOfferIncomingCall(error, offerSdp) {
    if (error) {
      return console.error('Error generating the offer');
    }
    this.response = {
      id : 'incomingCallResponse',
      from : this.from,
      callResponse : 'accept',
      sdpOffer : offerSdp
    };
    this.sendMessage(this.response);
  }*/
  sendMessage(message) {
    this.jsonMessage = JSON.stringify(message);
    console.log('Sending message: ' + this.jsonMessage);
    this.ws.send(this.jsonMessage);
  }

 /* onIceCandidate(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));

    this.message = {
      id : 'onIceCandidate',
      candidate : candidate
    };
    this.sendMessage(this.message);
  }*/
  /*onError() {
    this.setCallState(this.NO_CALL);
  }*/

  registerFN() {
    this.name = this.nameid.nativeElement.value;
    console.log(this.nameid.nativeElement.value)
    if (this.name === '') {
      window.alert('You must insert your user name');
      return;
    }
    this.setRegisterState(REGISTERING);

    this. message = {
      id : 'register',
      name: this.name
    };
    this.sendMessage(this.message);
  /* document.getElementById('peer').focus();*/
  }


}
