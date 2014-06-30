var fs = require('fs');
var util = require('util');
var moment = require('moment');
var extend = require('extend');
require('iconv-lite').extendNodeEncodings();

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
Squish.prototype.bufHash32 = function (buf) {
	var hash=0;
	for (var i=0;i<buf.length;i++){
		var strInt=String.fromCharCode(buf[i]).toLowerCase().charCodeAt(0);
		if (strInt!==0) {
			hash=(hash<<4)+strInt;
			var g = hash & 0xF0000000;
			if (g) {
				hash |= g >>> 24;
				hash |= g;
			}
		}
	}
	return hash & 0x7FFFFFFF;
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
			header.MsgLen=_Squish.SQD.readUInt32LE(offsetSQD+16);
			header.cLen=_Squish.SQD.readUInt32LE(offsetSQD+20);
			header.attrs=_Squish.SQD.readUInt32LE(offsetSQD+28);
			header.from=new Buffer(36);
			header.to=new Buffer(36);
			header.subj=new Buffer(72);
			_Squish.SQD.copy(header.from,0,offsetSQD+32,offsetSQD+32+36);
			_Squish.SQD.copy(header.to,0,offsetSQD+68,offsetSQD+68+36);
			_Squish.SQD.copy(header.subj,0,offsetSQD+104,offsetSQD+104+72);
			header.fromAddr=new Buffer(8);
			_Squish.SQD.copy(header.fromAddr,0,offsetSQD+176,offsetSQD+176+8);
			header.toAddr=new Buffer(8);
			_Squish.SQD.copy(header.toAddr,0,offsetSQD+184,offsetSQD+184+8);
			header.dateWritten=_Squish.SQD.readUInt32LE(offsetSQD+192);
			header.dateArrived=_Squish.SQD.readUInt32LE(offsetSQD+196);
			header.utc_offset=_Squish.SQD.readUInt16LE(offsetSQD+200);
			header.fromDate=new Buffer(20);
			_Squish.SQD.copy(header.fromDate,0,offsetSQD+246,offsetSQD+246+20);
			header.kludges=new Buffer(header.cLen);
			_Squish.SQD.copy(header.kludges,0,offsetSQD+266,offsetSQD+266+header.cLen);
			var seenPos=null;
			var pathPos=null;
			var endPos=offsetSQD+header.MsgLen+28;
			for (var i=offsetSQD+header.cLen+266;i<endPos-5;i++){
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
					if (_Squish.SQD[i]==1 && //\1
						_Squish.SQD[i+1]==80 && //P
						_Squish.SQD[i+2]==65 && //A
						_Squish.SQD[i+3]==84 && //T
						_Squish.SQD[i+4]==72 ){ //H
						pathPos=i;
					}
				}
			}
			if (seenPos!==null){
				header.msg=new Buffer(seenPos-(offsetSQD+header.cLen+266));
				_Squish.SQD.copy(header.msg,0,offsetSQD+header.cLen+266,seenPos);
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
					header.msg=new Buffer(pathPos-(offsetSQD+header.cLen+266));
					_Squish.SQD.copy(header.msg,0,(offsetSQD+header.cLen+266),pathPos);
					header.path=new Buffer(endPos-pathPos);
					_Squish.SQD.copy(header.path,0,pathPos,endPos);
				}else{
					header.msg=new Buffer(endPos-(offsetSQD+header.cLen+266));
					_Squish.SQD.copy(header.msg,0,(offsetSQD+header.cLen+266),endPos);
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
			var parts = /^codepage:\s*(\S+)(\s.*)?$/.exec(bkludges);
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
Squish.prototype.decodeKludges = function(header, decodeOptions){
	var options = extend({}, decodeDefaults, decodeOptions);
	var encoding=this.encodingFromHeader(header);
	if( encoding === null ) encoding = options.defaultEncoding;
	var re=/\u0001(.*?):\s*([^\u0001]*)/gm;
	var parts;
	var kludgesText = header.kludges.toString(encoding);
	var kludges = [];
	while ((parts=re.exec(kludgesText))!==null)
	{
		kludges.push(parts[1]+': '+parts[2]);
	}
	return kludges.join('\n');
};
Squish.prototype.decodeHeader = function(header, decodeOptions){
	var options = extend({}, decodeDefaults, decodeOptions);
	var encoding=this.encodingFromHeader(header);
	if( encoding === null ) encoding = options.defaultEncoding;
	var decoded={};
	decoded.Signature = header.Signature;
	decoded.kludges = [];
	decoded.origTime=moment.utc(header.fromDate.toString()).toArray();
	decoded.subj = header.subj.toString(encoding).replace(/\u0000/g,'');
	decoded.path = header.path.toString(encoding).replace(/\r/g,'\n').replace(/\u0000/g,'');
	decoded.seenby = header.seen.toString(encoding).replace(/\r/g,'\n').replace(/\u0000/g,'');
	decoded.from = header.from.toString(encoding).replace(/\u0000/g,'');
	decoded.rawto = header.to;
	decoded.to = header.to.toString(encoding).replace(/\u0000/g,'');
	decoded.fromAddr=header.fromAddr.readUInt16LE(0)+":"+header.fromAddr.readUInt16LE(2)+"/"+header.fromAddr.readUInt16LE(4)+"."+header.fromAddr.readUInt16LE(6);
	var re=/\u0001(.*?):\s*([^\u0001]*)/gm;
	var parts;
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
	}
	return decoded;
};
Squish.prototype.decodeMessage = function(header, decodeOptions, callback){
	var _Squish = this;
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;
		decodeOptions = void 0;
	}
	var options = extend({}, decodeDefaults, decodeOptions);
	var encoding=this.encodingFromHeader(header);
	if( encoding === null ) encoding = options.defaultEncoding;
	callback(null, header.msg.toString(encoding).replace(/\r/g, '\n'));
};
Squish.prototype.checkHash = function(number, callback){
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
Squish.prototype.getAvatarsForHeader = function(header, schemes, avatarOptions){
	var _Squish = this;
	var gravatarDefaults = {
		size: 200,
		rating: 'x',
		gravatarDefault: 'mm'
	};
	var options  = extend({}, decodeDefaults, gravatarDefaults, avatarOptions);
	schemes = schemes.map(function(scheme){
		return scheme.toLowerCase();
	});
	var findHTTPS = schemes.indexOf('https') > -1;
	var findHTTP  = schemes.indexOf('http')  > -1;
	var findFREQ  = schemes.indexOf('freq')  > -1;
	var regularAvatars = [];
	var gravatars = [];
	var avatarsGIF = [];
	var decoded = _Squish.decodeHeader( header, options );
	decoded.kludges.forEach(function(kludge){
		var matches;
		var regex;
		var avatarURL;
		regex = /^[Aa][Vv][Aa][Tt][Aa][Rr]:(?:.*\s)?((\S+?):\S+)\s*$/;
		matches = regex.exec(kludge);
		if( matches !== null ){
			avatarURL = matches[1];
			var avatarScheme = matches[2];
			if( schemes.indexOf(avatarScheme) > -1 ){
				regularAvatars.push(avatarURL);
			}
			return;
		}
		if( findHTTP || findHTTPS ){
			regex = /^[Gg][Rr][Aa][Vv][Aa][Tt][Aa][Rr]:\s*([01-9A-Fa-f]+)\s*$/;
			matches = regex.exec(kludge);
			if( matches !== null ){
				var gravatarHash = matches[1];
				if( findHTTPS ){ // secure:
					avatarURL = 'https://secure.gravatar.com/avatar/';
				} else { // insecure:
					avatarURL = 'http://www.gravatar.com/avatar/';
				}
				avatarURL += gravatarHash;
				avatarURL += '?s=' + options.size;
				avatarURL += '&r=' + options.rating;
				avatarURL += '&d=' + options.gravatarDefault;
				gravatars.push(avatarURL);
				return;
			}
		}
		if( findFREQ && ( options.origAddr || decoded.origAddr ) ){
			regex = /^[Gg][Ii][Ff]:\s*(\S+)\s*$/;
			matches = regex.exec(kludge);
			if( matches !== null ){
				var filenameGIF = matches[1];
				avatarURL = 'freq://' + ( options.origAddr || decoded.origAddr );
				avatarURL += '/' + filenameGIF + '.GIF';
				avatarsGIF.push(avatarURL);
				return;
			}
		}
	});
	if( gravatars.length  > 1 ) gravatars  = [];
	if( avatarsGIF.length > 1 ) avatarsGIF = [];
	return [].concat( regularAvatars, gravatars, avatarsGIF );
};
Squish.prototype.numbersForMSGID = function(MSGID, decodeOptions, callback) {
	var _Squish = this;
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;
		decodeOptions = void 0;
	}
	if( !Array.isArray(MSGID) ) MSGID = [ MSGID ];
	var options = extend({}, decodeDefaults, decodeOptions);
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) return callback(err);
		var resultArray = messageHeaders.map(function(hdr, idx){
			if (MSGID.indexOf(hdr.msgid)>-1) return idx+1;
			return null;
		}).filter(function(number){ return number!==null;});
		callback(null,resultArray);
	});
};
Squish.prototype.headersForMSGID = function(MSGID, decodeOptions, callback) {
	var _Squish = this;
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;
		decodeOptions = void 0;
	}
	if( !Array.isArray(MSGID) ) MSGID = [ MSGID ];
	var options = extend({}, decodeDefaults, decodeOptions);
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) return callback(err);
		var headersArray = messageHeaders.map(function(hdr, idx){
			if( MSGID.indexOf(hdr.msgid) > -1 ){
				hdr.MessageIndex = idx+1;
				return hdr;
			} else return null;
		}).filter(function(header){
			return header !== null;
		});
		callback(null, headersArray);
	});
};
Squish.prototype.errors = {
	NOT_A_POSITIVE: "The message's number must be positive!",
	TOO_BIG: "The message's number exceed the message base's size!",
	UNKNOWN_ENCODING: "Unknown encoding!"
};
Squish.prototype.get1stChildNumber = function(number, callback){
	number-=1;
	var _Squish = this;
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) callback(err);
		var arr=messageHeaders.map(function(hdr,idx) {
			if (hdr.replyid==messageHeaders[number].msgid)
				return idx+1;
			return null;
		}).filter(function(number){ return number!==null;});
		if (arr.length>0){callback(null,arr[0]);} else {
		callback(null,null);}
	});
};
Squish.prototype.getChildrenNumbers = function(number, callback){
	number-=1;
	var _Squish = this;
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) callback(err);
		var arr=messageHeaders.map(function(hdr,idx) {
			if (hdr.replyid==messageHeaders[number].msgid)
				return idx+1;
			return null;
		}).filter(function(number){ return number!==null;});
		callback(null,arr);
	});
};
Squish.prototype.getParentNumber = function(number, callback){
	number-=1;
	var _Squish = this;
	_Squish.readAllHeaders(function(err, messageHeaders){
		if (err) callback(err);
		if (!('replyid' in messageHeaders[number])){
			callback(null,null);
			return;
		}
		var arr=messageHeaders.map(function(hdr,idx) {
			if (hdr.msgid==messageHeaders[number].replyid)
				return idx+1;
			return null;
		}).filter(function(number){ return number!==null;});
		if (arr.length>0){callback(null,arr[0]);} else {
		callback(null,null);}
	});
};
Squish.prototype.getOrigAddr = function(header, decodeOptions, callback) {
	if(typeof callback === 'undefined' && typeof decodeOptions === 'function'){
		callback = decodeOptions;	
		decodeOptions = void 0;
	}
	callback(null,header.fromAddr);
};
Squish.prototype.getNextChildNumber = function(number,callback){
	number-=1;
	var _Squish=this;
	_Squish.getParentNumber(number+1,function(err,num2){
		if (err) callback(err);
		if (num2===null){callback(null,null);return;}
		_Squish.readAllHeaders(function(err, messageHeaders){
			if (err) callback(err);
			var arr=messageHeaders.map(function(hdr,idx) {
				if (hdr.replyid==messageHeaders[num2-1].msgid)
					if (idx>number) return idx+1;
				return null;
			}).filter(function(number){ return number!==null;});
			if (arr.length>0) {callback(null,arr[0]);return}
			callback(null,null);
		});
	});
};

module.exports = Squish;
