import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {WebrtcserviceService} from '../webrtcservice.service';
import {WebRtcPeer} from 'kurento-utils';
import {passBoolean} from 'protractor/built/util';
import {Subject} from 'rxjs';
import {NOT_REGISTERED} from '../appconstants';




@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit , OnDestroy {
  disableButtonCall1 = false;
  disableButtonTerminate1 = false;
  disableButtonRegister1 = false;
  ws:any

  constructor(private webrtcserviceService: WebrtcserviceService) {
   console.log('con called ***********************************');
   this.ws = new WebSocket('wss://' + location.host + '/call');
   this.webrtcserviceService.setWebSocket(this.ws);
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
    this.webrtcserviceService.setVideoInput(this.videoInput.nativeElement) ;
    this.webrtcserviceService.setVideoOutput(this.videoOutput.nativeElement);
    this.webrtcserviceService.setNameId(this.nameid.nativeElement);
    this.webrtcserviceService.setPeerId(this.peerid.nativeElement);
    this.webrtcserviceService.setRegisterState(NOT_REGISTERED);
    this.webrtcserviceService.getWebSocket().onmessage = message => {
      const parsedMessage = JSON.parse(message.data);
      console.log('Received message: ' + message.data);
      switch (parsedMessage.id) {
        case 'registerResponse':
          this.webrtcserviceService.registerResponse(parsedMessage);
          break;
        case 'callResponse':
          this.webrtcserviceService.callResponse(parsedMessage);
          break;
        case 'incomingCall':
          this.webrtcserviceService.incomingCall(parsedMessage);
          break;
        case 'startCommunication':
          this.webrtcserviceService.startCommunication(parsedMessage);
          break;
        case 'stopCommunication':
          console.log('Communication ended by remote peer');
          this.webrtcserviceService.stop(true);
          break;
        case 'iceCandidate':
         this.webrtcserviceService.addIceCandidatel(parsedMessage);
          break;
        default:
          console.log('Unrecognized message', parsedMessage);
      }
    };
  }


  ngOnDestroy(): void {
    this.webrtcserviceService.getWebSocket().close();
   }
  callFn(){
    this.webrtcserviceService.call();
    this.updateButton();
  }

  stop(b: boolean) {
    this.webrtcserviceService.stop(b);
    this.updateButton();
  }

  registerFN() {
    this.webrtcserviceService.register();
    this.updateButton();
  }

  updateButton(){
    this.disableButtonCall1 = this.webrtcserviceService.disableButtonCall;
    this.disableButtonTerminate1 = this.webrtcserviceService.disableButtonTerminate;
    this.disableButtonRegister1 = this.webrtcserviceService.disableButtonRegister;
  }
}
