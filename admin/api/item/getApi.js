var _ = require('underscore');
var async = require('async');
//var keystone = require('../../../');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));
var keystone = require('keystone');

module.exports = function(req, res) {
	var fields = req.query.fields;

	if (req.query.basic !== undefined) {
		fields = false;
	}

	var apiDetails = req.list.options.apiDetails.read;
	var endpoint = apiDetails.endpoint + '/' + req.params.id;

	superagent
		.getAsync(endpoint)
		.then(function(result) {
			var responseData = {
				data: result.body,
				raw: {
					operation: 'item'
				}
			}
			return req.list.options.apiDetails.read.getResponseData(responseData);
		})
		.then(function(item) {
			item.get = function(colName) {
				return this[colName];
			}

			var tasks = [];
			var drilldown = {};
			var relationships = {};

			async.parallel(tasks, function(err) {
				if (err) {
					return res.status(500).json({
						err: 'database error',
						detail: err
					});
				}

				res.json(_.assign(req.list.getData(item, fields), {
					relationships: relationships
				}));

			});

			return;

		})
		.catch(function(err) {
			console.log(err.stack || err);
		});
};
