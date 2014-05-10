var Squish = require('../');
var path = require('path');
var assert = require('assert');
var headCount = 1834;
var util = require('util');
var headSampleth = '1050th';
var headSample = 1050;
var headSampleMSGID = '2:5020/848 50c68f1e';

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
			console.log(util.inspect(
			            header, false, Infinity, true
			                     ));
			assert.equal(header.Signature,2947433555);
			console.log(util.inspect(echo.decodeHeader(header), false, Infinity, true));
			echo.decodeMessage(header,function(err, messageText){
				if (err) throw err;
				console.log('The '+headSampleth+' message (decoded):');
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
	                     
});
