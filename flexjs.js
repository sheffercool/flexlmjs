/*
 * The MIT License (MIT)
 * 
 * Copyright (C) 2016 Quantum HPC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of 
 * this software and associated documentation files (the “Software”), to deal in the 
 * Software without restriction, including without limitation the rights to use, copy, 
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the 
 * following conditions:

 * The above copyright notice and this permission notice shall be included in all 
 * copies or substantial portions of the Software.

 * The Software is provided “as is”, without warranty of any kind, express or implied, 
 * including but not limited to the warranties of merchantability, fitness for a particular 
 * purpose and noninfringement. In no event shall the authors or copyright holders be 
 * liable for any claim, damages or other liability, whether in an action of contract, 
 * tort or otherwise, arising from, out of or in connection with the software or the use 
 * or other dealings in the Software.
*/

// Fill out lmutil full path
var flexBinary = '/opt/bin/flex/lmutil';
var flexCmd = 'lmstat -a -c ';

var cproc = require('child_process');
var spawn = cproc.spawnSync;
var fs = require('fs');

// Regex for lmstat output
var featureRegEx=/^Users of ([^:]*):[^0-9:]*([0-9]+)[^0-9]*([0-9]+)[^0-9]*([\)]+)/;
var errorRegEx=/^Users of ([^:]*):[^0-9]*(Error)[^0-9]*([0-9]+)[^0-9]*,([^:]*)([\)]+)/;
var versionTokenRegEx=/\s*([^\s]*)\s+([^\s,]*),\s+([^\s]*)\s+([^\s,]*),\s+([^\s]*)\s+([^\s,]*)/;
var userTokenRegEx=/([^\s]*)\s+([^\s]*)\s+([^\s]*)\s+\(([^\s]*)\)\s+\(([^\)]*)\),\s+([^\s]*)\s(.*)/;
var result = {};
var tokenFeature;
var vendorInfo;

// Parse the output of lmutil lmstat and return a JSON array
// serverURL can be used to test with the output of lmstat stored in a file by sending an array ['test',filePath]
function lmstat(serverURL, callback){
  // Create Stream
  var output;
  if (serverURL[0] === 'test'){
    output = fs.readFileSync(serverURL[1],'utf8');
  }else{
    output = spawn(flexBinary, flexCmd + serverURL, { encoding : 'utf8' });
  }
  
  // Transmit the error if any
  if (output.stderr){
      return callback(new Error(output.stderr.replace(/\n/g,"")));
  }
  //output = output.stdout.split('\n');
  output = output.split('\n');

  for (var i=0; i<output.length; i++){
    // Line by line
    var line = output[i];
    var m;
    // Feature line
    m = line.match(featureRegEx);
    if (m) {
      //Assuming token line is given right after feature line, we save it for the next lines
      tokenFeature = m[1];
      // Push the feature
      result[tokenFeature] = {
        "total":m[2],
        "used":m[3],
        "free":m[2]-m[3],
        "tokens":[]
      };
    }else{
      // Token line with vendor
      m = line.match(versionTokenRegEx);
      if (m) {
        // Save the vendor information temporarly
        vendorInfo = {
          "name" : m[4],
          "version" : m[2],
          "expiry" : m[6]
        };
      }else{
        // Token line with username and machine
        m = line.match(userTokenRegEx);
        if (m) {
          // Need the previous lines to know which licence
          result[tokenFeature].tokens.push({
            "username" : m[1],
            "machine" : m[2],
            "started" : m[7],
            "vendorname" : vendorInfo.name,
            "version" : vendorInfo.version,
            "expiry" : vendorInfo.expiry
          });
        }else{
          // Error lines
          m = line.match(errorRegEx);
          if (m) {
            result[m[1]] = {
              "total":m[3],
              "error":m[4]
            };
          }
        }
      }
    }
  }
  // Return result table
  return callback(null, result);
}

module.exports = {
    lmstat           : lmstat,
};