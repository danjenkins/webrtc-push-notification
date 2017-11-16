'use strict';

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  TextInput,
  ListView,
  Platform,
} from 'react-native';

import io from 'socket.io-client';

const socket = io.connect('https://react-native-webrtc.herokuapp.com', {transports: ['websocket']});

import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';

import RNCallKit from 'react-native-callkit';
import NotificationsIOS from 'react-native-notifications';

import uuid from 'uuid';

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

const pcPeers = {};
let localStream;

function getLocalStream(isFront, callback) {

  let videoSourceId;

  // on android, you don't have to specify sourceId manually, just use facingMode
  // uncomment it if you want to specify
  if (Platform.OS === 'ios') {
    MediaStreamTrack.getSources(sourceInfos => {
      console.log("sourceInfos: ", sourceInfos);

      for (const i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if(sourceInfo.kind == "video" && sourceInfo.facing == (isFront ? "front" : "back")) {
          videoSourceId = sourceInfo.id;
        }
      }
    });
  }
  getUserMedia({
    audio: true,
    video: {
      mandatory: {
        minWidth: 640, // Provide your own width, height and frame rate here
        minHeight: 360,
        minFrameRate: 30,
      },
      facingMode: (isFront ? "user" : "environment"),
      optional: (videoSourceId ? [{sourceId: videoSourceId}] : []),
    }
  }, function (stream) {
    console.log('getUserMedia success', stream);
    callback(stream);
  }, logError);
}

function join(roomID) {
  socket.emit('join', roomID, function(socketIds){
    console.log('join', socketIds);
    for (const i in socketIds) {
      const socketId = socketIds[i];
      createPC(socketId, true);
    }
  });
}

function createPC(socketId, isOffer) {
  const pc = new RTCPeerConnection(configuration);
  pcPeers[socketId] = pc;

  pc.onicecandidate = function (event) {
    console.log('onicecandidate', event.candidate);
    if (event.candidate) {
      socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
    }
  };

  function createOffer() {
    pc.createOffer(function(desc) {
      console.log('createOffer', desc);
      pc.setLocalDescription(desc, function () {
        console.log('setLocalDescription', pc.localDescription);
        socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
      }, logError);
    }, logError);
  }

  pc.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }

  pc.oniceconnectionstatechange = function(event) {
    console.log('oniceconnectionstatechange', event.target.iceConnectionState);
    if (event.target.iceConnectionState === 'completed') {
      setTimeout(() => {
        getStats();
      }, 1000);
    }
    if (event.target.iceConnectionState === 'connected') {
      createDataChannel();
    }
  };
  pc.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event.target.signalingState);
  };

  pc.onaddstream = function (event) {
    console.log('onaddstream', event.stream);
    container.setState({info: 'One peer join!'});

    const remoteList = container.state.remoteList;
    remoteList[socketId] = event.stream.toURL();
    container.setState({ remoteList: remoteList });
  };
  pc.onremovestream = function (event) {
    console.log('onremovestream', event.stream);
  };

  pc.addStream(localStream);
  function createDataChannel() {
    if (pc.textDataChannel) {
      return;
    }
    const dataChannel = pc.createDataChannel("text");

    dataChannel.onerror = function (error) {
      console.log("dataChannel.onerror", error);
    };

    dataChannel.onmessage = function (event) {
      console.log("dataChannel.onmessage:", event.data);
      container.receiveTextData({user: socketId, message: event.data});
    };

    dataChannel.onopen = function () {
      console.log('dataChannel.onopen');
      container.setState({textRoomConnected: true});
    };

    dataChannel.onclose = function () {
      console.log("dataChannel.onclose");
    };

    pc.textDataChannel = dataChannel;
  }
  return pc;
}

function exchange(data) {
  const fromId = data.from;
  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }

  if (data.sdp) {
    console.log('exchange sdp', data);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      if (pc.remoteDescription.type == "offer")
        pc.createAnswer(function(desc) {
          console.log('createAnswer', desc);
          pc.setLocalDescription(desc, function () {
            console.log('setLocalDescription', pc.localDescription);
            socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
          }, logError);
        }, logError);
    }, logError);
  } else {
    console.log('exchange candidate', data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  const pc = pcPeers[socketId];
  const viewIndex = pc.viewIndex;
  pc.close();
  delete pcPeers[socketId];

  const remoteList = container.state.remoteList;
  delete remoteList[socketId]
  container.setState({ remoteList: remoteList });
  container.setState({info: 'One peer leave!'});
}

socket.on('exchange', function(data){
  exchange(data);
});
socket.on('leave', function(socketId){
  leave(socketId);
});

socket.on('connect', function(data) {
  console.log('connect');
  getLocalStream(true, function(stream) {
    localStream = stream;
    container.setState({selfViewSrc: stream.toURL()});
    container.setState({status: 'ready', info: 'Please Enter or Create room ID'});
  });
});

function logError(error) {
  console.log("logError", error);
}

function mapHash(hash, func) {
  const array = [];
  for (const key in hash) {
    const obj = hash[key];
    array.push(func(obj, key));
  }
  return array;
}

function getStats() {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  if (pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    console.log('track', track);
    pc.getStats(track, function(report) {
      console.log('getStats report', report);
    }, logError);
  }
}

let container;
let voipDeviceToken;

const RCTWebRTCDemo = React.createClass({
  getInitialState: function() {
    //Initialise RNCallKit
    let options = {
        appName: 'RNCallKitExample'
    };
    try {
        RNCallKit.setup(options);
        console.log("Callkit setup: ", RNCallKit);
    } catch (err) {
        console.log('error:', err.message);
    }
    let that = this;

    NotificationsIOS.addEventListener('remoteNotificationsRegistered', that.onPushRegistered);
		NotificationsIOS.addEventListener('remoteNotificationsRegistrationFailed', that.onPushRegistrationFailed);

    NotificationsIOS.addEventListener('notificationReceivedForeground', that.onNotificationReceivedForeground);
    NotificationsIOS.addEventListener('notificationReceivedBackground', that.onNotificationReceivedBackground);
    NotificationsIOS.addEventListener('notificationOpened', that.onNotificationOpened);

    NotificationsIOS.addEventListener('pushKitRegistered', that.onPushKitRegistered);
    NotificationsIOS.requestPermissions();
    NotificationsIOS.registerPushKit();

    // Add RNCallKit Events
    RNCallKit.addEventListener('answerCall', that.onRNCallKitPerformAnswerCallAction);
    RNCallKit.addEventListener('endCall', that.onRNCallKitPerformEndCallAction);
    RNCallKit.addEventListener('didActivateAudioSession', that.onRNCallKitDidActivateAudioSession);

    this.ds = new ListView.DataSource({rowHasChanged: (r1, r2) => true});


    return {
      info: 'Initializing',
      status: 'init',
      roomID: '',
      isFront: true,
      selfViewSrc: null,
      remoteList: {},
      textRoomConnected: false,
      textRoomData: [],
      textRoomValue: '',
    };
  },
  componentDidMount: function() {
    container = this;
  },
	componentWillUnmount: function() {
  	// prevent memory leaks!
    let that = this;
  	NotificationsIOS.removeEventListener('remoteNotificationsRegistered', that.onPushRegistered);
		NotificationsIOS.removeEventListener('remoteNotificationsRegistrationFailed', that.onPushRegistrationFailed);

    NotificationsIOS.removeEventListener('notificationReceivedForeground', that.onNotificationReceivedForeground);
  	NotificationsIOS.removeEventListener('notificationReceivedBackground', that.onNotificationReceivedBackground);
  	NotificationsIOS.removeEventListener('notificationOpened', that.onNotificationOpened);
    NotificationsIOS.removeEventListener('pushKitRegistered', onPushKitRegistered(this));
	},
  onPushRegistered: function(deviceToken) {
	    // TODO: Send the token to my server so it could send back push notifications...
		console.log("Device Token Received", deviceToken);
	},
  onPushRegistrationFailed: function(error) {
		console.error("PushRegistration Fails", error);
	},
  onNotificationReceivedForeground: function(notification) {
    console.log("Notification Received - Foreground");
	  // console.log("Notification Received - Foreground", notification);
    // console.log("voipDeviceToken: ", voipDeviceToken);
    // this.onIncomingCall(voipDeviceToken);
  },
  onNotificationReceivedBackground: function(notification) {
    console.log("Notification Received - Foreground");
  	// console.log("Notification Received - Background", notification);
    // console.log("voipDeviceToken: ", voipDeviceToken);
    // this.onIncomingCall(voipDeviceToken);
  },
  onNotificationOpened: function(notification) {
  	console.log("Notification opened by device user", notification);
    console.log("voipDeviceToken: ", voipDeviceToken);
    this.onIncomingCall(voipDeviceToken);
  },
  onPushKitRegistered: function(deviceToken) {
    console.log("PushKit Token Received: " + deviceToken);
    // voipDeviceToken = deviceToken;
    // this.onIncomingCall(deviceToken);
  },
  onRNCallKitPerformAnswerCallAction(data) {
    /* You will get this event when the user answer the incoming call
     *
     * Try to do your normal Answering actions here
     *
     * e.g. this.handleAnswerCall(data.callUUID);
     */
  },
  onRNCallKitPerformEndCallAction(data) {
    /* You will get this event when the user finish the incoming/outgoing call
     *
     * Try to do your normal Hang Up actions here
     *
     * e.g. this.handleHangUpCall(data.callUUID);
     */
  },
  onRNCallKitDidActivateAudioSession(data) {
    /* You will get this event when the the AudioSession has been activated by **RNCallKit**,
     * you might want to do following things when receiving this event:
     *
     * - Start playing ringback if it is an outgoing call
     */
  },
  onIncomingCall(token) {
    // Store the generated uuid somewhere
    // You will need this when calling RNCallKit.endCall()
    let _uuid = uuid.v4();
    console.log("uuid: ", _uuid);
    RNCallKit.displayIncomingCall(_uuid, token);
  },
  // This is a fake function where you hang up calls
  onHangUpCall() {
    // get the _uuid you stored earlier
    RNCallKit.endCall(_uuid)
  },
  _press(event) {
    this.refs.roomID.blur();
    this.setState({status: 'connect', info: 'Connecting'});
    join(this.state.roomID);
  },
  _switchVideoType() {
    const isFront = !this.state.isFront;
    this.setState({isFront});
    getLocalStream(isFront, function(stream) {
      if (localStream) {
        for (const id in pcPeers) {
          const pc = pcPeers[id];
          pc && pc.removeStream(localStream);
        }
        localStream.release();
      }
      localStream = stream;
      container.setState({selfViewSrc: stream.toURL()});

      for (const id in pcPeers) {
        const pc = pcPeers[id];
        pc && pc.addStream(localStream);
      }
    });
  },
  receiveTextData(data) {
    const textRoomData = this.state.textRoomData.slice();
    textRoomData.push(data);
    this.setState({textRoomData, textRoomValue: ''});
  },
  _textRoomPress() {
    if (!this.state.textRoomValue) {
      return
    }
    const textRoomData = this.state.textRoomData.slice();
    textRoomData.push({user: 'Me', message: this.state.textRoomValue});
    for (const key in pcPeers) {
      const pc = pcPeers[key];
      pc.textDataChannel.send(this.state.textRoomValue);
    }
    this.setState({textRoomData, textRoomValue: ''});
  },
  _renderTextRoom() {
    return (
      <View style={styles.listViewContainer}>
        <ListView
          dataSource={this.ds.cloneWithRows(this.state.textRoomData)}
          renderRow={rowData => <Text>{`${rowData.user}: ${rowData.message}`}</Text>}
          />
        <TextInput
          style={{width: 200, height: 30, borderColor: 'gray', borderWidth: 1}}
          onChangeText={value => this.setState({textRoomValue: value})}
          value={this.state.textRoomValue}
        />
        <TouchableHighlight
          onPress={this._textRoomPress}>
          <Text>Send</Text>
        </TouchableHighlight>
      </View>
    );
  },
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          {this.state.info}
        </Text>
        {this.state.textRoomConnected && this._renderTextRoom()}
        <View style={{flexDirection: 'row'}}>
          <Text>
            {this.state.isFront ? "Use front camera" : "Use back camera"}
          </Text>
          <TouchableHighlight
            style={{borderWidth: 1, borderColor: 'black'}}
            onPress={this._switchVideoType}>
            <Text>Switch camera</Text>
          </TouchableHighlight>
        </View>
        { this.state.status == 'ready' ?
          (<View>
            <TextInput
              ref='roomID'
              autoCorrect={false}
              style={{width: 200, height: 40, borderColor: 'gray', borderWidth: 1}}
              onChangeText={(text) => this.setState({roomID: text})}
              value={this.state.roomID}
            />
            <TouchableHighlight
              onPress={this._press}>
              <Text>Enter room</Text>
            </TouchableHighlight>
          </View>) : null
        }
        <RTCView streamURL={this.state.selfViewSrc} style={styles.selfView}/>
        {
          mapHash(this.state.remoteList, function(remote, index) {
            return <RTCView key={index} streamURL={remote} style={styles.remoteView}/>
          })
        }
        <TouchableHighlight
          onPress={this.onIncomingCall}>
          <Text>Display Call</Text>
        </TouchableHighlight>
      </View>
    );
  }
});

const styles = StyleSheet.create({
  selfView: {
    width: 200,
    height: 150,
  },
  remoteView: {
    width: 200,
    height: 150,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  listViewContainer: {
    height: 150,
  },
});

AppRegistry.registerComponent('RCTWebRTCDemo', () => RCTWebRTCDemo);
