importScripts('grid.js',
    'version.js',
    'detector.js',
    'formatinf.js',
    'errorlevel.js',
    'bitmat.js',
    'datablock.js',
    'bmparser.js',
    'datamask.js',
    'rsdecoder.js',
    'gf256poly.js',
    'gf256.js',
    'decoder.js',
    'qrcode.js',
    'findpat.js',
    'alignpat.js',
    'databr.js');

var barcodeDetector, barcodeDetectorErrored;

self.onmessage = function(e) {
  var data = e.data;

  if('BarcodeDetector' in self && !barcodeDetectorErrored) {
    barcodeDetector = barcodeDetector || new BarcodeDetector();

    barcodeDetector.detect(data)
    .then(barcodes => {
      // return the first barcode.
      // console.log(barcodes);
      if(barcodes.length > 0) {
        var bc = {rawValue: barcodes[0].rawValue, cornerPoints: barcodes[0].cornerPoints};
        // console.log(bc);
        postMessage(bc);
      }
      else {
        postMessage(undefined);
      }
    })
    .catch(err => {
      barcodeDetectorErrored = true;
      postMessage(undefined);
      console.error(err)
    });
  }
  else {
    try {
      var width = data.width;
      var height = data.height;
      var result = qrcode.decodeWithPoints(width, height, data);
      postMessage(result);
    }
    catch(e) {
      postMessage(undefined);
    }
  }


};
