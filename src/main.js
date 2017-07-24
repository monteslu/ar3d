var _ = require('lodash');
var $ = require ('jquery');
var Perspective = require('perspectivejs');
var POS = require('js-aruco').POS1;
var THREE = global.THREE = require('three');


var QRClient = require('./qrclient');
var lightning = require('./lightning');
var AvatarInit = require('./avatar');
var STARTING_WORD = 'NodeBots';
var AVATAR_SIZE = 256;
var AVATAR_PIC_SIZE = 100;
var MAX_CAM_SIZE = 800;
var QR_SIZE_MILLIS = 1000;
var qrScale = 1;
var canvas, img, context, video, start, streaming, detector, lastBC, posit, scanning;
var scene, camera, renderer;
var geometry, material, mesh;

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
      x: (corner.x * scale) - (canvas.width / 2),
      y: (canvas.height / 2) - (corner.y * scale)
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

  navigator.getMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


  var constraints = {
    audio: false,
    video: {
      facingMode: 'environment'
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
    video.play();
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

    console.log('scaled video dimentions', video.videoWidth, video.videoHeight);


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

    //renderer.setSize( window.innerWidth, window.innerHeight );

    // document.body.appendChild( renderer.domElement );

    console.log('gemoetry', geometry);

    function oldRender(bc) {
      ctx.drawImage(video, 0,0);

      if(bc || lastBC) {
        var lc = lightning();
        lastBC = bc || lastBC;

        // drawImage(imageObj, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);

        avatarCtx.drawImage(lc, 100, 100, AVATAR_SIZE, AVATAR_SIZE, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        var buckets = avatar.render(lastBC.rawValue, avatarCtx);

        var points = lastBC.cornerPoints;

        var pers = new Perspective(ctx, avatarCanvas);

        var rotateRadians = Math.atan2(points[3].y - points[2].y, points[3].x - points[2].x) + Math.PI;
        var avgHeight = ((points[3].y - points[0].y) + (points[2].y - points[1].y)) / 2;

        var textX = (points[3].x * qrScale + points[2].x * qrScale) / 2;
        var textY = (points[3].y * qrScale + points[2].y * qrScale) / 2 + (0.4 * avgHeight);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(rotateRadians);
        ctx.translate(-textX, -textY);
        ctx.textAlign = "center";
        ctx.textBaseline = 'middle';
        ctx.font = Math.round((points[3].y - points[0].y) * 0.4) + 'px serif';
        ctx.fillStyle = colors[buckets[5]];
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = invertColor(colors[buckets[5]]);
        ctx.fillText(lastBC.rawValue, textX, textY);
        ctx.strokeText(lastBC.rawValue, textX, textY);
        ctx.restore();
      }


    }

    function render() {
      if(lastBC) {
        var renderStart = Date.now();
        var lc = lightning();
        avatarCtx.drawImage(lc, 100, 100, AVATAR_SIZE, AVATAR_SIZE, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        cubeMaterial.map.needsUpdate = true;
        var buckets = avatar.render(lastBC.rawValue, avatarCtx);

        var centeredPts = centerCorners(lastBC.cornerPoints, canvas, qrScale);
        var pose = posit.pose(centeredPts);
        // console.log('posit', bc.cornerPoints, centeredPts, pose)

        mesh.position.x = pose.bestTranslation[0] / 2;
        mesh.position.y = pose.bestTranslation[1] / 2;
        var prevZ = mesh.position.z;
        mesh.position.z = (4500 - pose.bestTranslation[2]) / 5;
        // console.log(pose.bestTranslation, prevZ, mesh.position.z);

        var thetaX = Math.atan2(pose.bestRotation[2][1], pose.bestRotation[2][2]);
        var thetaY = Math.atan2(pose.bestRotation[2][0], Math.sqrt(pose.bestRotation[2][1] * pose.bestRotation[2][1] + pose.bestRotation[2][2] * pose.bestRotation[2][2]) );
        var thetaZ = Math.atan2(pose.bestRotation[1][0], pose.bestRotation[0][0]);

        // console.log('posit', pose.bestRotation, thetaX, thetaY, thetaZ);

        mesh.rotation.x = -thetaX; //very jumpy
        mesh.rotation.y = thetaY;
        mesh.rotation.z = thetaZ;


        renderer.render( scene, camera );
        // console.log('render end', Date.now() - renderStart);

      }
    }


    function step(timestamp) {

      // might be scanning on own thread, but should always render
      if(!scanning) {
        scanning = true;
        parseVideoCtx.drawImage(video, 0,0, parseVideoCanvas.width, parseVideoCanvas.height);
        var decodeStart = Date.now();
        client.decode(parseVideoCtx, function(bc) {
          console.log('decode time', Date.now() - decodeStart);
          lastBC = bc || lastBC;
          scanning = false;
          if(bc) {
            console.log('bc', bc);
          }
        });
      }
      render(lastBC);
      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);


  });





});
