var fs = require('fs');
var util = require('util');
var sb = require('singlebyte');
var moment = require('moment');
var extend = require('util')._extend;

var Squish = function(echoPath){
	if (!(this instanceof Squish)) return new Squish(echoPath);
	this.echoPath = echoPath;
	this.SQD = null;
	this.indexStructure = null;
	this.lastreads = null;
};
Squish.prototype.readSQL = function(callback){
	var _Squish = this;
	if (_Squish.lastreads !== null) return callback(null);

	fs.readFile(_Squish.echoPath+'.sql', function(err, data){
		if (err) return callback(err);
		_Squish.lastreads=data.readUInt32LE(0);
//		console.log("lastreads: ",_Squish.lastreads);
		callback(null);
	});
};
Squish.prototype.readSQI = function(callback){
	var _Squish = this;
	if (_Squish.indexStructure !== null) return callback(null);
	fs.readFile(_Squish.echoPath+'.sqi', function(err, data){
		if (err) return callback(err);
		_Squish.indexStructure = [];
		var indexOffset = 0;
		var MessageOffset;
		var MessageNum; 
		var hash;
		while( indexOffset + 12 <= data.length ){
			MessageOffset = data.readUInt32LE(indexOffset);
			indexOffset += 4;
			MessageNum = data.readUInt32LE(indexOffset); 
			indexOffset += 4;
			hash = data.readUInt32LE(indexOffset); 
			indexOffset += 4;
			_Squish.indexStructure.push({
				'offset': MessageOffset,
				'MessageNum0': MessageNum,
				'CRC': hash
			});
		}
		callback(null);
	});
};
Squish.prototype.clearCache = function(cache){
	switch(cache){
		case 'lastreads':
			this.lastreads = null;
			break;
		case 'text':
			this.SQD = null;
			break;
		case 'index':
			this.indexStructure = null;
			break;
		default:
			this.lastreads = null;
			this.SQD = null;
			this.indexStructure = null;
			break;
	}
};
Squish.prototype.size = function(){
	if( this.indexStructure === null ){
		return void 0;
	} else {
		return this.indexStructure.length;
	}
};
Squish.prototype.readSQD = function(callback){
	var _Squish = this;
	if (_Squish.SQD !== null) return callback(null);
	fs.readFile(_Squish.echoPath+'.sqd', function(err, data){
		if (err) return callback(err);
		_Squish.SQD=data;
		callback(null);
	});

};
Squish.prototype.readHeader = function(number, callback){ // err, struct
	var _Squish = this;
	if( number <= 0 ){
		return callback(new Error(this.errors.NOT_A_POSITIVE));
	}
	_Squish.readSQI(function(err){
		if (err) return callback(err);
		if( number > _Squish.size() ){
			return callback(new Error(this.errors.TOO_BIG));
		}
		_Squish.readSQD(function(err){
			if (err) return callback(err);
			var header = {};
			var offsetSQD = _Squish.indexStructure[number-1].offset;
			header.Signature =_Squish.SQD.readUInt32LE(offsetSQD);
			offsetSQD+=16;
			header.MsgLen=_Squish.SQD.readUInt32LE(offsetSQD);
			offsetSQD+=4;
			header.cLen=_Squish.SQD.readUInt32LE(offsetSQD);
			offsetSQD+=12;
//			header.unknown=_Squish.SQD.readUInt32LE(offsetSQD);
			header.from=new Buffer(36);
			header.to=new Buffer(36);
			header.subj=new Buffer(72);
			_Squish.SQD.copy(header.from,0,offsetSQD,offsetSQD+36);
			offsetSQD+=36;
			_Squish.SQD.copy(header.to,0,offsetSQD,offsetSQD+36);
			offsetSQD+=36;
			_Squish.SQD.copy(header.subj,0,offsetSQD,offsetSQD+72);
			offsetSQD+=72;
			header.fromAddr=new Buffer(8);
			_Squish.SQD.copy(header.fromAddr,0,offsetSQD,offsetSQD+8);
			offsetSQD+=8;
			header.toAddr=new Buffer(8);
			_Squish.SQD.copy(header.toAddr,0,offsetSQD,offsetSQD+8);
			offsetSQD+=8;
			header.dateWritten=_Squish.SQD.readUInt32LE(offsetSQD);
//			console.log(header.dateWritten.toString(2));
//			console.log(moment({d:(header.dateWritten & 31),M:((header.dateWritten>>5)&15)-1,y:1980+((header.dateWritten>>9)&127),s:((header.dateWritten>>16)&31)*2,m:((header.dateWritten>>21)&63),h:((header.dateWritten>>27)&31)}).toString());
			offsetSQD+=4;
			header.dateArrived=_Squish.SQD.readUInt32LE(offsetSQD);
//			console.log(moment({d:(header.dateArrived & 31),M:((header.dateArrived>>5)&15)-1,y:1980+((header.dateArrived>>9)&127),s:((header.dateArrived>>16)&31)*2,m:((header.dateArrived>>21)&63),h:((header.dateArrived>>27)&31)}).toString());
//			console.log(util.inspect(_Squish.indexStructure[number-1],false,Infinity,true));
//			console.log(header.MsgLeno);
			offsetSQD+=4;
			header.utc_offset=_Squish.SQD.readUInt16LE(offsetSQD);
			offsetSQD+=46;
			header.fromDate=new Buffer(20);
			_Squish.SQD.copy(header.fromDate,0,offsetSQD,offsetSQD+20);
			offsetSQD+=20;
			header.kludges=new Buffer(header.cLen);
			_Squish.SQD.copy(header.kludges,0,offsetSQD,offsetSQD+header.cLen);
			offsetSQD+=header.cLen;
			var seenPos=null;
			var pathPos=null;
			var endPos=offsetSQD+header.MsgLen-238-header.cLen;
			for (var i=offsetSQD;i<offsetSQD+header.MsgLen-238-header.cLen-5;i++){
				if (seenPos===null){
					if (_Squish.SQD[i]==13 && //\r
						_Squish.SQD[i+1]==83 && //S
						_Squish.SQD[i+2]==69 && //E
						_Squish.SQD[i+3]==69 && //E
						_Squish.SQD[i+4]==78 ){ //N
						seenPos=i+1;
					}
				}
				if (pathPos===null){
					if (_Squish.SQD[i]==1 && //\r
						_Squish.SQD[i+1]==80 && //P
						_Squish.SQD[i+2]==65 && //A
						_Squish.SQD[i+3]==84 && //T
						_Squish.SQD[i+4]==72 ){ //H
						pathPos=i;
					}
				}
			}
			if (seenPos!==null){
				header.msg=new Buffer(seenPos-offsetSQD);
				_Squish.SQD.copy(header.msg,0,offsetSQD,seenPos);
				if (pathPos!==null){
					header.seen=new Buffer(pathPos-seenPos);
					_Squish.SQD.copy(header.seen,0,seenPos,pathPos);
					header.path=new Buffer(endPos-pathPos);
					_Squish.SQD.copy(header.path,0,pathPos,endPos);
				}else {
					header.seen=new Buffer(endPos-seenPos);
					_Squish.SQD.copy(header.seen,0,seenPos,endPos);
				}
			}else {
				if (pathPos!==null){
					header.msg=new Buffer(pathPos-offsetSQD);
					_Squish.SQD.copy(header.msg,0,offsetSQD,pathPos);
					header.path=new Buffer(endPos-pathPos);
					_Squish.SQD.copy(header.path,0,pathPos,endPos);
				}else{
					header.msg=new Buffer(endPos-offsetSQD);
					_Squish.SQD.copy(header.msg,0,offsetSQD,endPos);
				}
			}
			callback(null,header);
		});
		
	});
};
var normalizedEncoding = function(encoding){
   /* jshint indent: false */
	switch(encoding){
		case '+7_fido':    return 'cp866';   //break
		case '+7':         return 'cp866';   //break
		case 'iso-8859-1': return 'latin-1'; //break
		case 'utf-8':      return 'utf8';    //break
		default:           return encoding;  //break
	}
};
Squish.prototype.encodingFromHeader = function(header){
	var bkludges = header.kludges.toString('ascii').toLowerCase();
	var parts=/(?:chrs|charset):\s*(\S+)(\s.*)?/.exec(bkludges);
	if( parts !== null ){
		var chrs = parts[1];
		if( chrs === 'ibmpc' ){
			parts = /^codepage:\s*(\S+)(\s.*)?$/.exec(bkludges);
			if( parts !== null ){
				chrs = parts[1];
				return normalizedEncoding(chrs);
			}else{
				return normalizedEncoding('cp866');
			}
		}
		return normalizedEncoding(chrs);
	}
	return null;
};
var decodeDefaults = {
	// for decodeHeader, decodeMessage, numbersForMSGID, headersForMSGID,
	//     getAvatarsForHeader, getOrigAddr
	defaultEncoding: 'cp866',
	useDefaultIfUnknown: true
};
Squish.prototype.decodeHeader = function(header, decodeOptions){
	var options = extend(decodeDefaults, decodeOptions);
	var encoding=this.encodingFromHeader(header);
	if( encoding === null ) encoding = options.defaultEncoding;
	var decoded={};
	decoded.kludges = [];
	decoded.origTime=moment.utc(header.fromDate.toString()).toArray();
	decoded.subject = sb.bufToStr(header.subj,encoding).replace(/\u0000/g,'');
	decoded.path = sb.bufToStr(header.path,encoding).replace(/\r/g,'\n').replace(/\u0000/g,'');
	decoded.seenby = sb.bufToStr(header.seen,encoding).replace(/\r/g,'\n').replace(/\u0000/g,'');
	decoded.from = sb.bufToStr(header.from,encoding).replace(/\u0000/g,'');
	decoded.to = sb.bufToStr(header.to,encoding).replace(/\u0000/g,'');
	decoded.fromAddr=header.fromAddr.readUInt16LE(0)+":"+header.fromAddr.readUInt16LE(2)+"/"+header.fromAddr.readUInt16LE(4)+"."+header.fromAddr.readUInt16LE(6);
	var re=/\u0001(.*?):\s*([^\u0001]*)/gm;
	while ((parts=re.exec(header.kludges))!==null)
	{
		switch (parts[1].toLowerCase()){
			case 'pid':
				decoded.pid=parts[2];
				break;
			case 'msgid':
				decoded.msgid=parts[2];
				break;
			case 'tzutc':
				decoded.timezone=parts[2];
				break;
			case 'reply':
				decoded.replyid=parts[2];
				break;
			default:
				decoded.kludges.push(parts[1]+': '+parts[2]);
		}
//		console.log("kl: "+util.inspect(parts));
	}
	return decoded;
};
Squish.prototype.decodeMessage = function(header, decodeOptions, callback){
	var _Squish = this;
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;
		decodeOptions = void 0;
	}
	var options = extend(decodeDefaults, decodeOptions);
	var encoding=this.encodingFromHeader(header);
	if( encoding === null ) encoding = options.defaultEncoding;
    callback(null, sb.bufToStr(
               header.msg, encoding
                     ).replace(/\r/g, '\n'));
                     
};
Squish.prototype.readAllHeaders = function(callback){
	var _Squish = this;
	_Squish.readSQI(function(err){
		if (err) return callback(err);
		var size=_Squish.size();
		var messageHeaders=[];
		var nextHeaderNumber = 0;
		var nextHeaderProcessor = function(){
			if (nextHeaderNumber>=size){
				return callback(null,messageHeaders);
			}
			nextHeaderNumber++;
			_Squish.readHeader(nextHeaderNumber, function(err, header){
				messageHeaders.push(_Squish.decodeHeader(header));
				setImmediate(nextHeaderProcessor);
			});
		};
		nextHeaderProcessor();
	});
};
Squish.prototype.numbersForMSGID = function(MSGID, decodeOptions, callback) {
	var _Squish = this;
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;
		decodeOptions = void 0;
	}
	if( !Array.isArray(MSGID) ) MSGID = [ MSGID ];
	var options = extend(decodeDefaults, decodeOptions);
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) return callback(err);
		var resultArray = messageHeaders.map(function(hdr, idx){
			if (MSGID.indexOf(hdr.msgid)>-1) return idx+1;
			return null;
		}).filter(function(number){ return number!==null;});
		callback(null,resultArray);
	});
};
Squish.prototype.errors = {
	NOT_A_POSITIVE: "The message's number must be positive!",
	TOO_BIG: "The message's number exceed the message base's size!",
	UNKNOWN_ENCODING: "Unknown encoding!"
};
module.exports = Squish;