async function mySecrets(secretName) {
    // Load the AWS SDK
    var AWS = require('aws-sdk'),
        region = process.env.AWS_REGION,
        secretName = secretName,
        secret,
        decodedBinarySecret;

    // Create a Secrets Manager client
    var client = new AWS.SecretsManager({
        region: region
    });

    return new Promise((resolve,reject)=>{
        client.getSecretValue({SecretId: secretName}, function(err, data) {

            // In this sample we only handle the specific exceptions for the 'GetSecretValue' API.
            // See https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
            // We rethrow the exception by default.
            if (err) {
                reject(err);
            }
            else {
                // Decrypts secret using the associated KMS CMK.
                // Depending on whether the secret is a string or binary, one of these fields will be populated.
                if ('SecretString' in data) {
                    resolve(data.SecretString);
                } else {
                    let buff = new Buffer(data.SecretBinary, 'base64');
                    resolve(buff.toString('ascii'));
                }
            }
        });
    });
}

// inside handler
exports.handler = async (event, context) => {
    
    const secret = event.ResourceProperties.secretName;
    console.log(event.ResourceProperties)

    var value = await mySecrets(secret);
    console.log(value);
    
    value = JSON.parse(value)
    
    console.log(value.host)

    sendResponse(event, context, 'SUCCESS', { 'Message': 'Resource creation successful!',  'host': value.host, 'db_pass': value.password, 'user': value.username});

    return

};



// Send response to the pre-signed S3 URL
function sendResponse (event, context, responseStatus, responseData) {
  console.log('Sending response ' + responseStatus)
  var responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  })

  console.log('RESPONSE BODY:\n', responseBody)

  var https = require('https')
  var url = require('url')

  var parsedUrl = url.parse(event.ResponseURL)
  var options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  }

  console.log('SENDING RESPONSE...\n')

  var request = https.request(options, function (response) {
    console.log('STATUS: ' + response.statusCode)
    console.log('HEADERS: ' + JSON.stringify(response.headers))
    // Tell AWS Lambda that the function execution is done
    context.done()
  })

  request.on('error', function (error) {
    console.log('sendResponse Error:' + error)
    // Tell AWS Lambda that the function execution is done
    context.done()
  })

  // write data to request body
  request.write(responseBody)
  request.end()
}
