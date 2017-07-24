module.exports = function() {
  var nativeWorker = new Worker('/scripts/nativeworker.js');
  var worker = new Worker('/scripts/jsqrcode/qrworker.js');
  var barcodeDetector;
  var barcodeDetectorErrored = false;

  var currentCallback;

  this.decode = function(context, callback) {
    currentCallback = callback;
    if('BarcodeDetector' in window && !barcodeDetectorErrored) {
      nativeWorker.postMessage(context.canvas.toDataURL());
      currentCallback = callback;
    }
    else {
      // A frame has been captured.
      try {
        var canvas = context.canvas;
        var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage(imageData);
      }
      catch(err) {
        console.error(err);
      }
    }
  };

  worker.onmessage = function(e) {
    if(currentCallback) {
      currentCallback(e.data);
    }
  };

  nativeWorker.onmessage = function(e) {
    if(e.data && e.data.error) {
      barcodeDetectorErrored;
    }
    if(currentCallback) {
      currentCallback(e.data);
    }
  };

 };
