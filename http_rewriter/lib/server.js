#!/usr/bin/env node

var path=require('path');
var _=require('underscore');
var util=require('util');
var log4js=require('log4js');

var DEBUG=false;

var logger=log4js.getLogger(NAME);

var http = require('http');

var CONFIG = require('./server.conf');

var DEBUG=true;

function Redirector() {
}

