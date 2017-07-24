var md5 = require('blueimp-md5');
var FULL_SIZE = 256;

function init(size, imgSrc) {


  var img= new Image();
  img.onload = function () {
     console.info("Image loaded !");
     //do something...
    //  render(STARTING_WORD);
  }
  img.onerror = function () {
     console.error("Cannot load img");
     //do something else...
  }
  img.src = imgSrc;

  function render(input, context) {
    return renderHash(md5(input || ''), context);
  }

  function renderHash(hash, context) {
    if(!hash && hash.length < 32) {
      hash = md5(hash || '');
    }
    //strip uuid dashes
    hash = hash.replace(/\-/g, '');
    return renderBuckets(getBuckets(hash), context);
  }

  function getBuckets(hash) {
    var b = new Buffer(hash, 'hex');
    var pairs = _.reduce(b, function(result, value, key) {
        if(key % 2) {
          result.push([b[key-1], b[key]]);
          return result;
        }
        return result;
    }, []);
    return _.map(pairs, function(val) {
      return ((val[0] << 8) + val[1]) % 10;
    });
  }

  function renderBuckets(buckets, context) {
    // console.log(buckets);

    var bodyStyle = buckets[0];
    var headStyle = buckets[1];
    var eyeStyle = buckets[2];
    var mouthStyle = buckets[3];
    var accStyle = buckets[4];
    var bhColor = buckets[5];
    var emColor = buckets[6];
    var accColor = buckets[7];


    if(img) {
      // context.clearRect(0, 0, context.canvas.width, context.canvas.height);

      context.drawImage(img, size * bodyStyle, 5 * size * bhColor + 3 * size, size, size, 0, 0, FULL_SIZE, FULL_SIZE);
      context.drawImage(img, size * headStyle, 5 * size * bhColor + 4 * size, size, size, 0, 0, FULL_SIZE, FULL_SIZE);
      context.drawImage(img, size * mouthStyle, 5 * size * emColor, size, size, 0, 0, FULL_SIZE, FULL_SIZE);
      context.drawImage(img, size * eyeStyle, 5 * size * emColor + size, size, size, 0, 0, FULL_SIZE, FULL_SIZE);
      context.drawImage(img, size * accStyle, 5 * size * accColor + 2 * size, size, size, 0, 0, FULL_SIZE, FULL_SIZE);
    }

    return buckets;
  }

  return {
    render: render,
    renderBuckets: renderBuckets,
    renderHash: renderHash
  };
}


module.exports = init;
