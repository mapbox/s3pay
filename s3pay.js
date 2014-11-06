#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var url = require('url');

var s3 = new AWS.S3();

function usage() {
  console.log('Usage: ./s3pay <ls|cp> <remote> [destination]\n');
  console.log('Examples:');
  console.log('./s3pay cp s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708_ne_18_1_20130924.tif');
  console.log('./s3pay cp s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708_ne_18_1_20130924.tif /mnt/data/m_3807708_ne_18_1_20130924.tif');
  console.log('./s3pay ls s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708');
}

process.argv.shift();
process.argv.shift();
if (process.argv.length > 3 || process.argv.length === 0) {
  usage();
  process.exit(0);
}

var command = process.argv.shift();
var srcpath = process.argv.shift();
var dstpath = process.argv.shift() || path.join(__dirname, path.basename(srcpath));
dstpath = path.resolve(dstpath);
srcpath = url.parse(srcpath);

if (command !== 'cp' && command !== 'ls') {
  console.error('ERROR: s3pay only supports cp and ls commands');
  usage();
  process.exit(1);
}

if (srcpath.protocol !== 's3:') {
  console.error('ERROR: Please use an S3 URI of the type "s3://bucket/key"');
  usage();
  process.exit(1);
}

if (fs.existsSync(dstpath) && command === 'cp') {
  console.error('ERROR: File already exists: ' + dstpath);
  process.exit(1);
}


var bucket = srcpath.hostname;
var key = srcpath.pathname.slice(1);

var params = { Bucket: bucket };
if (command === 'cp') params.Key = key;
if (command === 'ls') params.Prefix = key;

var run = command === 'cp' ? headObject : listObjects;

var attempts = 5;
run();

function listObjects(marker) {
  if (marker) params.Marker = marker;
  var req = s3.listObjects(params);
  req.httpRequest.headers['x-amz-request-payer'] = 'requester';
  req.on('success', function(response) {
    response.data.Contents.forEach(function(item) {
      console.log(JSON.stringify(item, null, 2));
    });

    if (response.data.IsTruncated) listObjects(data.NextMarker);
  });
  req.on('error', function(err) {
    console.error('ListObjects failed with %s', err);
    process.exit(1);
  });
  req.send();
}

function headObject() {
  attempts -= 1;

  if (attempts < 0) {
    console.error('Failed to HEAD ' + url.format(srcpath));
    process.exit(1);
  }

  var req = s3.headObject(params);
  req.httpRequest.headers['x-amz-request-payer'] = 'requester';
  req
    .on('success', function(res) {
      var contentLength = parseInt(res.data.ContentLength);
      attempts = 3;
      getObject(contentLength);
    })
    .on('error', function(err) {
      console.log('HEAD object failed with %s, retrying in 5 sec...', err);
      setTimeout(headObject, 5000);
    })
    .send();
}


function getObject(expectedSize) {
  attempts -= 1;

  if (attempts < 0) {
    process.stderr.write('Failed to GET ' + srcpath + '\n');
    process.exit(1);
  }

  var req = s3.getObject(params);
  var dst = fs.createWriteStream(dstpath);

  req.httpRequest.headers['x-amz-request-payer'] = 'requester';
  req = req.createReadStream().on('error', function() {
    console.error('GET object error: %s', err);
    dst.close();
  });

  dst.on('close', function() {
    if (this.bytesWritten === expectedSize) process.exit(0);

    fs.unlink(dstpath, function() {
      console.error('GET object failed to complete, retrying in 5 sec...');
      setTimeout(function() {
        getObject(expectedSize);
      }, 5000);
    });
  });

  req.pipe(dst);
}
