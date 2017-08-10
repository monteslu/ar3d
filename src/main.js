var _ = require('lodash');
var $ = require ('jquery');
var POS = require('js-aruco').POS1;
var THREE = global.THREE = require('three');

var fontData = require('./fonts/optimer_regular.typeface.json');
var QRClient = require('./qrclient');
var lightning = require('./lightning');
var AvatarInit = require('./avatar');

var font = new THREE.Font(fontData);
var STARTING_WORD = 'NodeBots';
var AVATAR_SIZE = 256;
var AVATAR_PIC_SIZE = 100;
var MAX_CAM_SIZE = 1280;
var QR_SIZE_MILLIS = 1000;
var qrScale = 1;
var canvas, img, context, video, start, streaming, detector, lastBC, posit, scanning, videoPlaying, lastText, lastColor;
var scene, camera, renderer;
var geometry, material, mesh, textGeometry, textMesh, textGroup;

var colors = ['#26a9e0','#8a5d3b', '#37b34a', '#a6a8ab', '#f7921e', '#ff459f', '#90278e', '#ed1c24', '#f1f2f3', '#faec31'];
var lastUpdate = Date.now();
var avatar = AvatarInit(AVATAR_PIC_SIZE, 'set1_s.png');

var client = new QRClient();

function invertColor(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    // invert color components
    var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
        g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
        b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
    return '#' + padZero(r) + padZero(g) + padZero(b);
}

function scaleCorners(input, scale, ratio) {
  var pts = _.map(input, function(pt) {
    return {x: pt.x, y: pt.y};
  });

  pts[0].x -= pts[0].x * scale / ratio;
  pts[0].y -= pts[0].y * scale * ratio;
  pts[1].x += pts[1].x * scale / ratio;
  pts[1].y -= pts[1].y * scale * ratio;
  pts[2].x += pts[2].x * scale / ratio;
  pts[2].y += pts[2].y * scale * ratio;
  pts[3].x -= pts[3].x * scale / ratio;
  pts[3].y += pts[3].y * scale * ratio;

  //console.log('scaleCorners input', input, 'output', pts, scale, ratio);
  return pts;
}

function centerCorners(corners, canvas, scale) {
  return _.map(corners, function(corner){
    return {
      x: Math.round((corner.x * scale) - (canvas.width / 2)),
      y: Math.round((canvas.height / 2) - (corner.y * scale))
    };
  })
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}



$(function() {

  var video = document.getElementById('video');
  var parseVideoCanvas = document.createElement('canvas');
  var parseVideoCtx = parseVideoCanvas.getContext('2d');
  var canvas = document.getElementById('canvas');
  // var ctx = canvas.getContext('2d');
  var avatarCanvas = document.createElement('canvas');
  avatarCanvas.height = AVATAR_SIZE;
  avatarCanvas.width = AVATAR_SIZE;
  var avatarCtx = avatarCanvas.getContext('2d');

  var accelData = {x: 0, y: 0, z: 0};
  var accelDataText, prevAccelDataText;
  window.accelData = accelData;
  var midiFound = false;

  navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


  var constraints = {
    audio: false,
    video: {
      // facingMode: 'environment',
      optional: [
          // {minWidth: 800},
          {minWidth: 1280},
          // {minWidth: 1920},
          // {minWidth: 2560}
      ]
    },
  };

  navigator.getMedia(constraints, function(stream) {
    if(navigator.mozGetUserMedia){
      video.mozSrcObject = stream;
    }
    else {
      var vu = window.URL || window.webkitURL;
      video.src = vu.createObjectURL(stream);
    }

    var playPromise = video.play();
    if (playPromise !== null) {
      playPromise.then(function() {
        videoPlaying = true;
      })
      .catch(function(err) {
        console.log('didnt like auto playing', err);
        //mobile needs a touch to start playing
        document.body.addEventListener('click', function() {
          if(!videoPlaying) {
            console.log('play on this click');
            video.play();
            videoPlaying = true;
          }
        }, true);
      });
    }
    else {
      videoPlaying = true;
    }


  }, function(error) {
    console.error(error);
  });

  video.addEventListener('canplay', function(ev) {

    // console.log('video', video, video.videoHeight, video.videoWidth );
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    posit = new POS.Posit(QR_SIZE_MILLIS, canvas.width);

    console.log('starting video dimentions', video.videoWidth, video.videoHeight);



    if(video.videoHeight > MAX_CAM_SIZE) {
      qrScale = video.videoHeight / MAX_CAM_SIZE;
    }
    else if(video.videoWidth > MAX_CAM_SIZE) {
      qrScale = video.videoWidth / MAX_CAM_SIZE;
    }

    parseVideoCanvas.width = video.videoWidth / qrScale;
    parseVideoCanvas.height = video.videoHeight / qrScale;

    console.log('scaled video dimentions', parseVideoCanvas.width, parseVideoCanvas.height, 'scale', qrScale);


    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, video.videoWidth/ video.videoHeight, 1, 10000 );
    camera.position.z = 1000;

    window.geomtery = geometry = new THREE.BoxGeometry( 400, 400, 400 );
    // material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );
    // var cubeMaterial = new THREE.MeshLambertMaterial({ color: 0x1ec876 });
    var cubeMaterial = new THREE.MeshBasicMaterial();
    window.mesh = mesh = new THREE.Mesh( geometry, cubeMaterial );
    scene.add( mesh );

    // set canvas as cubeMaterial.map (this could be done to any map, bump, displacement etc.)
		cubeMaterial.map = new THREE.Texture( avatarCanvas );
		// need to flag the map as needing updating.
		cubeMaterial.map.needsUpdate = true;

    renderer = new THREE.WebGLRenderer({canvas: canvas, alpha: true});
    renderer.setClearColor( 0x000000, 0);

    var pointLight = new THREE.PointLight(0xffffff);
    pointLight.position.set(-20, 200, 1000);

    scene.add(pointLight);



    console.log('gemoetry', geometry);

    function createText(text) {
      var createTime = Date.now();
      if(textGroup) {
        scene.remove(textGroup);
        // console.log('remove text time', Date.now() - createTime);
      }

      textGeometry = new THREE.TextGeometry( text, {
        font: font,
        size: 140,
        height: 50,
        curveSegments: 1,
    		bevelEnabled: false,

      });
      textGeometry.computeBoundingBox();
      var centerOffset = -0.5 * ( textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x );

      var materials = [
        new THREE.MeshBasicMaterial( { color: lastColor || Math.random() * 0xffffff, overdraw: 0.5 } ),
        new THREE.MeshBasicMaterial( { color: 0x555555, overdraw: 0.5 } )
      ];
      textMesh = new THREE.Mesh( textGeometry, materials );

      textMesh.position.x = centerOffset;
      textMesh.rotation.y = Math.PI * 2;
      textGroup = new THREE.Group();
      textGroup.add( textMesh );
      scene.add( textGroup );

      window.textMesh = textMesh;
      window.textGroup = textGroup;
      textMesh.centerOffset = centerOffset;
      console.log('text create time', Date.now() - createTime);

    }

    function render() {
      if(lastBC) {
        var renderStart = Date.now();
        var lc = lightning();
        avatarCtx.drawImage(lc, 100, 100, AVATAR_SIZE, AVATAR_SIZE, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        cubeMaterial.map.needsUpdate = true;
        var buckets = avatar.render(lastBC.rawValue, avatarCtx);
        lastColor = colors[buckets[5]];

        if(lastText !== lastBC.rawValue) {
          lastText = lastBC.rawValue;
          createText(lastBC.rawValue);
        }

        if(midiFound) {
          accelDataText = `x:${accelData.x} y:${accelData.y} z:${accelData.z}`;
          if(accelDataText != prevAccelDataText) {
            createText(accelDataText);
            prevAccelDataText = accelDataText;
          }

        }


        var centeredPts = centerCorners(lastBC.cornerPoints, canvas, qrScale);
        var pose = posit.pose(centeredPts);
        // console.log('posit', bc.cornerPoints, centeredPts, pose)

        var newX = pose.bestTranslation[0] / 2;
        var newY = pose.bestTranslation[1] / 2;
        var newZ = (6500 - pose.bestTranslation[2]) / 5;



        var thetaX = Math.atan2(pose.bestRotation[2][1], pose.bestRotation[2][2]);
        var thetaY = Math.atan2(pose.bestRotation[2][0], Math.sqrt(pose.bestRotation[2][1] * pose.bestRotation[2][1] + pose.bestRotation[2][2] * pose.bestRotation[2][2]) );
        var thetaZ = Math.atan2(pose.bestRotation[1][0], pose.bestRotation[0][0]);

        // console.log('posit', pose.bestRotation, thetaX, thetaY, thetaZ);

        //console.log(thetaX, thetaY);
        thetaX = Math.round(thetaX * 100) / 100;
        if(Math.abs(thetaX) < 0.1) {
          thetaX = 0;
        }
        thetaY = Math.round(thetaY * 100) / 100;
        if(Math.abs(thetaY) < 0.1) {
          thetaY = 0;
        }

        // console.log(thetaX, thetaY);

        mesh.position.x = newX;
        mesh.position.y = newY;
        mesh.position.z = newZ;

        mesh.rotation.x = -thetaX; //very jumpy
        mesh.rotation.y = thetaY;
        mesh.rotation.z = thetaZ;

        if(textGroup) {
          textGroup.position.x = newX;
          textGroup.position.y = newY - 400;
          textGroup.position.z = newZ + 50;

          textGroup.rotation.x = -thetaX;
          textGroup.rotation.y = thetaY;
          textGroup.rotation.z = thetaZ;
        }

        renderer.render( scene, camera );
        // console.log('render end', Date.now() - renderStart);

      }
    }


    function step(timestamp) {

      // might be scanning on own thread, but should always render
      if(videoPlaying && !scanning) {
        scanning = true;
        parseVideoCtx.drawImage(video, 0,0, parseVideoCanvas.width, parseVideoCanvas.height);
        // var decodeStart = Date.now();
        client.decode(parseVideoCtx, function(bc) {
          // console.log('decode time', Date.now() - decodeStart);
          lastBC = bc || lastBC;
          scanning = false;
          if(bc) {
            if(lastBC && lastBC.rawValue !== bc.rawValue) {
              console.log('new barcode', bc);
            }
            // console.log('bc', bc);
          }
        });
      }
      render(lastBC);
      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);


  });


  // request MIDI access
  if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({
          sysex: false
      }).then(onMIDISuccess, onMIDIFailure);
  } else {
      node.error("No MIDI support in your browser.");
  }


  // midi functions
  function onMIDISuccess(midiAccess) {

      var inputs = Array.from(midiAccess.inputs.values());
      console.log('inputs', inputs);

      _.forEach(inputs, function(input){
        midiFound = true;
        setTimeout(function() {
          document.title = document.title + ' midi';
        },1500);

        input.onmidimessage = function(message) {
            var data = message.data; // this gives us our [command/channel, note, velocity] data.
            // console.log('MIDI data in', data); // MIDI data [144, 63, 73]
            if(data[0] === 144){
              accelData.x = data[1] + (data[2] << 7);
            } else if(data[0] === 145){
              accelData.y = data[1] + (data[2] << 7);
            } else if(data[0] === 146){
              accelData.z = data[1] + (data[2] << 7);
            }
        };
      });

  }

  function onMIDIFailure(error) {
      // when we get a failed response, run this code
      node.error("No access to MIDI devices or your browser doesn't support WebMIDI API" + error);
  }



});
