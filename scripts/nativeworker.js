
// var img = new Image();
var barcodeDetector;

var imageData = new ImageData(100, 100);


function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;

}


self.onmessage = function(e) {
  var dataURL = e.data;


  if('BarcodeDetector' in self) {
    barcodeDetector = barcodeDetector || new BarcodeDetector();
    // img.src = dataURL;
    //barcodeDetector.detect(context.canvas)
    var blob = dataURItoBlob(dataURL);
    createImageBitmap(blob)
    .then(function(imgBitmap){
      // console.log(imgBitmap);
      return barcodeDetector.detect(imgBitmap)
    })
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
      postMessage({error: err.toString()});
      console.error(err)
    });
  }
  else {
    postMessage({error: 'unsupported'});
  }


};
