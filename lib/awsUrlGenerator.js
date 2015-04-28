var crypto = require('crypto');
var keystone = require('../');
var s3Config = keystone.get('s3 config');
var awsSecretKey = s3Config.secret;
var awsAccessKey = s3Config.key;

function generateCanonicalString(url, expires) {
  var strippedBaseUrl = '/' + url.split('/').slice(3).join('/');
  return "GET\n\n\n" + expires + "\n" + strippedBaseUrl;
}

function generateSignedUrl(url, expires, accessKey, signature) {
  //This format comes from the developer guide: http://s3.amazonaws.com/doc/s3-developer-guide/RESTAuthentication.html
  return url + '?AWSAccessKeyId=' + accessKey + '&Expires=' + expires + '&Signature=' + signature;
}

function generateSignature (data, awsSecretKey, algorithm, encoding) {
  encoding = encoding || "base64";
  algorithm = algorithm || "sha1";

  var hmac = crypto.createHmac('sha1', awsSecretKey);
  hmac.write(data);
  hmac.setEncoding('base64');
  hmac.end();

  return encodeURIComponent(hmac.read());
}

exports = module.exports = {
  generate: function(url) {
    // expiration limit in seconds, 3600 -> 1 hour
    // TODO: should get limit from config
    var limit = 3600;
    var now = Math.floor(((new Date()) / 1000));
    var expires = now + limit;
    var canonicalString = generateCanonicalString(url, expires);
    var signature = generateSignature(canonicalString, awsSecretKey);

    return generateSignedUrl(url, expires, awsAccessKey, signature);
  }
};
