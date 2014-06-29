var Squish = require('../');
var path = require('path');
var assert = require('assert');
var headCount = 1834;
var util = require('util');
var headSampleth = '1040th';
var headSample = 1040;
var parentSample = 1038
var childrenSamples = [1040,1043];
var headSampleMSGID = '2:5020/848 50c4a74e';

describe('Fidonet Squish', function(){
	var echo=Squish( path.join(__dirname, "ru.linux.chainik"));
	it('calculates correct Squish hash of an empty string', function(){
		assert.equal(echo.bufHash32(new Buffer('')), 0);
	});
	it('calculates correct Squish hash of the string "Alexander N. Skovpen"',
		function(){
		assert.equal(echo.bufHash32(new Buffer('Alexander N. Skovpen')), 15718334);
	});
	it('reads lastreads, can clear the cache afterwards', function(done){
		echo.readSQL(function(err){
			if (err) throw err;
			assert.equal(echo.lastreads,965);
			echo.clearCache('lastreads');
			assert.equal(echo.lastreads,null);
			done();
		});
	});
	it('reads index, can clear the cache afterwards', function(done){
		echo.readSQI(function(err){
			if (err) throw err;
			assert.equal(echo.size(), headCount);
			echo.clearCache('index');
			assert.equal(echo.size(), null);
			done();
		});
	});
	it('reads the '+headSampleth+' header, its encoding and contents, clears cache', function(done){
		echo.readHeader(headSample, function(err, header){
			console.log(util.inspect(echo.indexStructure[headSample-1], false, Infinity, true));
			console.log(util.inspect(header, false, Infinity, true));
			assert.equal(header.Signature,2947433555);
			console.log(util.inspect(echo.decodeHeader(header),false, Infinity, true));

			console.log('\nKludges of the '+headSampleth+' header:');
			console.log( echo.decodeKludges(header) );

			echo.decodeMessage(header,function(err, messageText){
				if (err) throw err;
				console.log('\nThe '+headSampleth+' message (decoded):');
				console.log(util.inspect(
					messageText, false, Infinity, true
				));
				console.log('The '+headSampleth+' message (output):');
				console.log(messageText);
				assert.notEqual(echo.SQD, null);
				assert.notEqual(echo.indexStructure, null);
				echo.clearCache('text');
				assert.equal(echo.SQD, null);
				assert.notEqual(echo.indexStructure, null);
				echo.clearCache();
				assert.equal(echo.SQI, null);
				assert.equal(echo.indexStructure, null);
				done();
			});
		});
	});
	var a=[];
	for (i=1;i<=500;i++){
		a.push(i);
	}
	it ('read '+headCount+ ' decoded headers', function(done){
		echo.readAllHeaders(function(err,messageHeaders){
			if (err) throw err;
			assert.equal(messageHeaders.length, headCount);
			done();
		});
	});
	it ('check hash for '+headCount+ ' messages', function(done){
		echo.readAllHeaders(function(err,messageHeaders){
			if (err) throw err;
			for (var i=0;i<messageHeaders.length;i++){
				assert.equal(echo.bufHash32(new Buffer(messageHeaders[i].rawto)), echo.indexStructure[i].CRC);
			}
			done();
		});
	});
	it('the cache is cleared, then a MSGID search is correct', function(done){
		echo.clearCache();
		echo.numbersForMSGID(headSampleMSGID, function(err, arr){
			if (err) throw err;
			assert.deepEqual(arr, [headSample]);
			echo.numbersForMSGID([
				headSampleMSGID, 'some wrong MSGID'
				], function(err, arr){
				if (err) throw err;
				assert.deepEqual(arr, [headSample]);
				echo.numbersForMSGID('some wrong MSGID', function(err, arr){
					if (err) throw err;
					assert.deepEqual(arr, []);
					done();
				});
			});
		});
	});
   it('a MSGID search for a header is also correct', function(done){
      echo.readHeader(headSample, function(err, header){
         if (err) throw err;
         header=echo.decodeHeader(header);
         header.MessageIndex = headSample;

         echo.headersForMSGID(headSampleMSGID, function(err, arr){
            if (err) throw err;
            assert.deepEqual(arr, [header]);

            echo.headersForMSGID([
               headSampleMSGID, 'some wrong MSGID'
            ], function(err, arr){
               if (err) throw err;
               assert.deepEqual(arr, [header]);

               echo.headersForMSGID('some wrong MSGID', function(err, arr){
                  if (err) throw err;
                  assert.deepEqual(arr, []);
                  done();
               });
            });
         });
      });
   });
   it('gets the correct number of the parent', function(done){
      echo.getParentNumber(childrenSamples[1], function(err, parentNumber){
         if (err) throw err;
         assert.equal(parentNumber, parentSample);
         done();
      });
   });
   it('gets the correct number of the 1st child', function(done){
      echo.get1stChildNumber(parentSample, function(err, childNumber){
         if (err) throw err;
         assert.equal(childNumber, childrenSamples[0]);
         done();
      });
   });
   it('gets the correct number of the next child', function(done){
      echo.getNextChildNumber(childrenSamples[0], function(err,siblingNumber){
         if (err) throw err;
         assert.equal(siblingNumber, childrenSamples[1]);
         done();
      });
   });
   it('gets the correct lists of children', function(done){
      echo.getChildrenNumbers(parentSample, function(err, childrenNumbers){
         if (err) throw err;
         assert.deepEqual(childrenNumbers, childrenSamples);

         echo.getChildrenNumbers(headSample, function(err, childrenNumbers){
            if (err) throw err;
            assert.deepEqual(childrenNumbers, [1044]);
            done();
         });
      });
   });
});
