# s3pay

s3 cp and ls commands for requester-pays buckets

## Install

```sh
$ npm install -g s3pay
```

## Usage
```sh
# Download a file to the current directory
$ s3pay cp s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708_ne_18_1_20130924.tif

# Download a file to a named path
$ s3pay cp s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708_ne_18_1_20130924.tif /downloads/my-new.tif

# List the files in an S3 bucket
$ s3pay ls s3://aws-naip/md/2013/1m/rgbir/38077/m_3807708
```
