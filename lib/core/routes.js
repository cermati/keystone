var debug = require('debug')('keystone:core:routes');

/**
 * Adds bindings for the keystone routes
 *
 * ####Example:
 *
 *     var app = express();
 *     app.use(...); // middleware, routes, etc. should come before keystone is initialised
 *     keystone.routes(app);
 *
 * @param {Express()} app
 * @api public
 */
function routes(app) {
	this.app = app;
	var keystone = this;

	// ensure keystone nav has been initialised
	if (!this.nav) {
		debug('setting up nav');
		this.nav = this.initNav();
	}

	// Cache compiled view templates if we are in Production mode
	this.set('view cache', this.get('env') === 'production');

	// Session API
	// TODO: this should respect keystone auth options
	// We're going to use /internals/cms/keystone instead of /keystone to give attackers harder time guessing
	var baseURI = '/internals/cms';

	app.get(baseURI + '/keystone/api/session', require('../../admin/api/session/get'));
	app.post(baseURI + '/keystone/api/session/signin', require('../../admin/api/session/signin'));
	app.post(baseURI + '/keystone/api/session/signout', require('../../admin/api/session/signout'));

	// Bind auth middleware (generic or custom) to /keystone* routes, allowing
	// access to the generic signin page if generic auth is used
	if (this.get('auth') === true) {
		if (!this.get('signout url')) {
			this.set('signout url', baseURI + '/keystone/signout');
		}
		if (!this.get('signin url')) {
			this.set('signin url', baseURI + '/keystone/signin');
		}
		if (!this.nativeApp || !this.get('session')) {
			app.all(baseURI + '/keystone*', this.session.persist);
		}
		app.all(baseURI + '/keystone/signin', require('../../admin/routes/views/signin'));
		app.all(baseURI + '/keystone/signout', require('../../admin/routes/views/signout'));
		app.all(baseURI + '/keystone*', this.session.keystoneAuth);
	} else if ('function' === typeof this.get('auth')) {
		app.all(baseURI + '/keystone*', this.get('auth'));
	}

	function initList(respectHiddenOption) {
		return function(req, res, next) {
			req.list = keystone.list(req.params.list);

			if (!req.list || (respectHiddenOption && req.list.get('hidden'))) {
				debug('could not find list ', req.params.list);
				req.flash('error', 'List ' + req.params.list + ' could not be found.');
				return res.redirect(baseURI + '/keystone');
			}

			debug('getting list ', req.params.list);
			next();
		};
	}

	debug('setting keystone Admin Route');
	app.all(baseURI + '/keystone', require('../../admin/routes/views/home'));

	// Email test routes
	if (this.get('email tests')) {
		debug('setting email test routes');
		this.bindEmailTestRoutes(app, this.get('email tests'));
	}

	// Cloudinary API for selecting an existing image / upload a new image
	if (keystone.get('cloudinary config')) {
		debug('setting cloudinary api');
		app.get(baseURI + '/keystone/api/cloudinary/get', require('../../admin/api/cloudinary').get);
		app.get(baseURI + '/keystone/api/cloudinary/autocomplete', require('../../admin/api/cloudinary').autocomplete);
		app.post(baseURI + '/keystone/api/cloudinary/upload', require('../../admin/api/cloudinary').upload);
	}

	// Init API request helpers
	app.use('/keystone/api', function(req, res, next) {
		res.apiError = function(key, err) {
			var statusCode = 500;
			if (key === 404) {
				statusCode = 404;
				key = null;
				key = 'not found';
			}
			if (!key) {
				key = 'unknown error';
			}
			if (!err) {
				err = 'API Error';
			}
			if (typeof err === 'object' && err.message) {
				err = err.message;
			}
			res.status(statusCode);
			res.json({ err: err, key: key });
		};
		next();
	});

	// Generic Lists API
	app.all(baseURI + '/keystone/api/:list/:action(autocomplete|order|create|fetch)', initList(), require('../../admin/api/list'));
	app.post(baseURI + '/keystone/api/:list/delete', initList(), require('../../admin/api/list/delete'));
	app.get(baseURI + '/keystone/api/:list', initList(), require('../../admin/api/list/get'));
	app.get(baseURI + '/keystone/api/:list/:id', initList(), require('../../admin/api/item/get'));
	app.post(baseURI + '/keystone/api/:list/:id/delete', initList(), require('../../admin/api/item/delete'));

	app.all(baseURI + '/keystone/download/:list', initList(), require('../../admin/api/download'));

	// Admin-UI API
	app.all(baseURI + '/keystone/:list/:page([0-9]{1,5})?', initList(true), require('../../admin/routes/views/list'));
	app.all(baseURI + '/keystone/:list/:item', initList(true), require('../../admin/routes/views/item'));

	return this;
}

module.exports = routes;
