var path=require('path');
var _=require('underscore');
var util=require('util');
var log4js=require('log4js');

// ------------- global variables --------
var CONFIG_FILE=path.normalize(__dirname+"/../etc/server.conf");
var CONFIG;

// ------------- setup log ---------------
var logger;

function initLog(cfg) {
	if (logger) return;

	cfg.log=_.extend({
		file:'http_rewriter.log',
		maxsize: null,
		backup: null,
		level: 'INFO'
	},cfg.log || {});

	console.log("Redirecting log to "+cfg.log.file+" (maxsize="+cfg.log.maxsize+" backup="+cfg.log.backup+" level="+cfg.log.level+")");

	//log4js.clearAppenders();
	log4js.loadAppender("file");
	log4js.addAppender(log4js.appenders.file(
		cfg.log.file,
		null,
		cfg.log.maxsize*1024 || 1024*1024,
		cfg.log.backup || 5
	));

	logger=log4js.getLogger("main");
	logger.setLevel(cfg.log.level);
}

// ------------- load config -------------

function loadConfig(file) {
	console.log("Loading config from "+file);
	var cfg=require(file);

	initLog(cfg);

	return cfg;
}

// -------------------------- main program ------------------------

function main() {
	console.log("---------------------------------------------------");

	CONFIG=loadConfig(CONFIG_FILE);
	logger.info("-------------- new daemon session -----------------");
	if (!CONFIG)
		throw new Error("Unable to load configuration");

	var fs=require('fs');
	fs.watchFile(CONFIG_FILE,function(c,p) {
		logger.info("Config file "+CONFIG_FILE+" was updated");
		restart();
	});

	// ------------- install exceptions & signal handlers ----------------

	process.on("uncaughtException", function(err) { 
		logger.fatal(err.stack); 
	});

	process.on("SIGUSR1", function() {
		logger.info("Got SIGUSR1");
		restart();
	});

	['SIGHUP','SIGINT','SIGQUIT','SIGTERM'].forEach(function(sig) {
		process.on(sig, function() {
			logger.info("Stopping...");
			// produce crash for start-stop-daemon
			if (process.argv[2]!='run')
				throw new Error("Stopped by signal "+sig);
			// don't exit: this make start-stop-daemon think the process
			// exited gracefully
			process.exit(1);
		});
	});

	// init redirector
	var HR=require("../lib/index.js");
	var srv=new HR.Rewriter(CONFIG.server);
	srv.listen();
}

function restart() {
	logger.info("Restarting...");
	throw new Error("Restarting process");
}

module.exports=main; // called from http_rewriter.js


