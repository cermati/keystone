var async = require('async');
var keystone = require('../../../');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));
var lodash = require('lodash');

module.exports = function(req, res) {
	if (!keystone.security.csrf.validate(req)) {
		return res.apiError('invalid csrf');
	}
	if (req.list.get('nodelete')) {
		return res.apiError('nodelete');
	}
	var ids = req.body.ids || req.body.id;
	if (typeof ids === 'string') {
		ids = ids.split(',');
	}
	if (!Array.isArray(ids)) {
		return res.apiError('invalid ids', 'ids must be an Array or comma-delimited list of ids');
	}
	if (req.user) {
		var userId = String(req.user.id);
		if (ids.some(function(id) {
			return id === userId;
		})) {
			return res.apiError('not allowed', 'You can not delete yourself');
		}
	}
	if (req.list.options.useApi) {
		var request;
		var endpoint = req.list.options.apiDetails.delete.endpoint + `/${req.body.id}`;

		/**
		 * Handle multiple method for deletion, delete is not necessary literally deletion, can be update or etc
		 * for general purpose
		 */
		switch(lodash.toUpper(req.list.options.apiDetails.delete.method)) {
			case 'POST':
				request = superagent.post(endpoint);
				break;
			case 'PATCH':
				request = superagent.patch(endpoint);
				break;
			case 'PUT':
				request = superagent.put(endpoint);
				break;
			case 'DELETE':
				request = superagent.delete(endpoint);
				break;
		}

		request.endAsync()
			.then(function(result){
				return res.json({
					success: true,
					ids: [req.query.delete],
					count: 1
				});
			})
			.catch(function(err){
				req.flash('error', 'Failed delete ' + req.list.singular + ' | ' + err);
				return res.redirect('/keystone/' + req.list.path);
			});
	} else {
		var deletedCount = 0;
		var deletedIds = [];
		req.list.model.find().where('_id').in(ids).exec(function (err, results) {
			if (err) return res.apiError('database error', err);
			async.forEachLimit(results, 10, function(item, next) {
				item.remove(function (err) {
					if (err) return next(err);
					deletedCount++;
					deletedIds.push(item.id);
					next();
				});
			}, function() {
				return res.json({
					success: true,
					ids: deletedIds,
					count: deletedCount
				});
			});
		});	
	}
	
};
