var _ = require('underscore');
var async = require('async');
var baby = require('babyparse');
var keystone = require('../../');
var moment = require('moment');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));
var json2csv = require('json2csv');

exports = module.exports = function(req, res) {
	var filters = req.list.processFilters(req.query.q);
	var queryFilters = req.list.getSearchFilters(req.query.search, filters);
	var relFields = [];

	superagent.getAsync(req.list.options.apiDetails.read.endpoint)
		.then(function(result) {
			var responseData = {
				data: result.body,
				raw: {
					operation: 'listing'
				}
			}
			return req.list.options.apiDetails.read.getResponseData(responseData);
		})
		.then(function(items) {
			var csv = json2csv({data: items, fields: _.keys(req.list.fields)});
			res.attachment(req.list.path + '-' + moment().format('YYYYMMDD-HHMMSS') + '.csv');
			res.setHeader('Content-Type', 'application/octet-stream');
			res.end(csv, 'utf-8');
		})
};
