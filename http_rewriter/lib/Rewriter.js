var _=require('underscore');
var util=require('util');
var log4js=require("log4js");
var path=require("path");

var http = require('http');
var https = require('https');
var url = require('url');

var logger=log4js.getLogger("rewriter");

var DEBUG=true;

/*------------------ Rule class -----------------------*/

/* create a rule:
 * match: string, regexp or function
 * rewrite: string or function
 */
function Rule(id,match,rewrite) {
	this.id=id;

	if (typeof match == 'function') {
		this._matchfunc=match;
	}
	else {
		if (typeof match == 'string') {
			match=new RegExp(match);
		}
		else if (!(match instanceof RegExp)) {
			throw new Error("Invalid match for rule "+id+": "+util.inspect(match));
		}

		this._matchfunc=_.bind(match.exec,match);
	}

	if (typeof rewrite == 'function') {
		this._rewritefunc=rewrite;
	}
	else if (typeof rewrite == 'string') {
		// replace $1, $2 ... by captured strings in re (from result)
		this._rewritefunc=function(url,result) {
			return rewrite.replace(/\$(\d)/g, function(dollarn,n) {
				return result[n];
			});
		};
	}
	else {
		throw new Error("Invalid rewrite for rule "+id+": "+util.inspect(rewrite));
	}
}

Rule.prototype.exec=function(url) {
	var res=this._matchfunc(url);
	if (!res) return false;

	var newurl=this._rewritefunc(url,res);

	//DEBUG && logger.debug("URL "+url+" matches rules "+this.id+" - rewritten to "+newurl);
	return newurl;
}

/*------------------ Rewriter class --------------------*/

var Rewriter=module.exports=function(opts) {
	var cfg=_.extend({
		// listen port
		port: 5000,
		timeout: 5000,
		rules: []
	},opts || {});

	DEBUG && logger.debug("Creating Rewriter server with config: "+util.inspect(cfg));
	_.extend(this,cfg);

	// init rules
	this.rules=[]; 
	cfg.rules.forEach(function(r,idx) {
		this.rules.push(new Rule(idx, r.match, r.rewrite));
	},this);

	DEBUG && logger.debug("Rules: "+util.inspect(this.rules));
}

Rewriter.prototype.listen=function(cb) {
	this._server=http.createServer(_.bind(this.handle_request,this));

	this._server.listen(this.port, _.bind(function() {
		logger.info("Listening on port "+this.port);
		if (cb) cb.call(null,null,this._server); // cb(err,server)
	},this));
}
	
Rewriter.prototype.handle_request=function(req,res) {
	DEBUG && logger.debug(req.connection.remoteAddress+" "+req.method+" "+req.url+" (host: "+req.headers.host+")");
	
	var newurl;
	// apply rules
	if (!this.rules.some(function(rule) {
		newurl=rule.exec(req.url);
		if (newurl) 
			return true;
		return false;
	},this)) {
		res.writeHead(404);
		res.end("URL "+req.url+" doesn't match any rule.");
		return;
	}

	//DEBUG && logger.debug("Redirecting to "+newurl);

	// parse new url
	var preq_opts=url.parse(newurl);

	// add method and headers from client request
	_.extend(preq_opts,{
		method: req.method,
		headers: _.clone(req.headers)
	});
	delete preq_opts.headers.host;
	delete preq_opts.headers.connection;

	DEBUG && logger.debug("Request: "+util.inspect(preq_opts));

	// open request to server
	var preq;
	switch (preq_opts.protocol) {
		case 'http:':
			preq=http.request(preq_opts);
			break;
		case 'https:':
			preq=https.request(preq_opts);
			break;
		case 'null:':
			res.writeHead(200); res.end(); return;
			break;
		default:
			throw new Error("Unable to handle protocol "+preq_opts.protocol);
	}

	// proxy request might fail
	preq.addListener('error',function (socketException) {
		logger.error("Request to "+host+":"+port+" failed - server is unreachable");
		res.writeHead(503,{'content-type': 'text/html'});
		res.end("Server "+host+":"+port+" unreachable");
	});

	// forward client data to server
	req.addListener('data', function(chunk) {
		preq.write(chunk, 'binary');
	});

	req.addListener('end', function() {
		preq.end();
	});

	// handle server responde
	preq.addListener('response', function(pres) {
		// If we have a "Connection: foo" header preserve it. Otherwise default to "close".
		if (pres.headers.connection) {
			pres.headers.connection = req.headers.connection || 'close';
		}
		
		// force location to initial url
		pres.headers['Content-Location']="http://"+req.headers.host+req.url;

		// send the initial response back to the client
		res.writeHead(pres.statusCode, pres.headers);
		DEBUG && logger.debug("Response: "+util.inspect({ status: pres.statusCode, headers: pres.headers}));

		// no 'data' event and no 'end'
		if (pres.statusCode === 304) {
			res.end();
			return;
		}

		var bytes=0;

		// Send results from the proxy server back to the originating client
		pres.addListener('data', function(chunk) {
			res.write(chunk, 'binary');
			bytes+=chunk.length;
		});
		pres.addListener('end', function() {
			res.end();
			DEBUG && logger.debug(bytes+" bytes transfered");
		});
		pres.addListener('error',function (socketException) {
			logger.error("Request to "+host+":"+port+" failed - server is unreachable");
			res.writeHead(503,{'content-type': 'text/html'});
			res.end("Server "+host+":"+port+" unreachable");
		});
	});
}

