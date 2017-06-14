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
	app.get('/keystone/api/session', require('../../admin/api/session/get'));
	app.post('/keystone/api/session/signin', require('../../admin/api/session/signin'));
	app.post('/keystone/api/session/signout', require('../../admin/api/session/signout'));

	// Bind auth middleware (generic or custom) to /keystone* routes, allowing
	// access to the generic signin page if generic auth is used
	if (this.get('auth') === true) {
		if (!this.get('signout url')) {
			this.set('signout url', '/keystone/signout');
		}
		if (!this.get('signin url')) {
			this.set('signin url', '/keystone/signin');
		}
		if (!this.nativeApp || !this.get('session')) {
			app.all('/keystone*', this.session.persist);
		}
		app.all('/keystone/signin', require('../../admin/routes/views/signin'));
		app.all('/keystone/signout', require('../../admin/routes/views/signout'));
		app.all('/keystone*', this.session.keystoneAuth);
	} else if ('function' === typeof this.get('auth')) {
		app.all('/keystone*', this.get('auth'));
	}

	function initList(respectHiddenOption) {
		return function(req, res, next) {
			req.list = keystone.list(req.params.list);

			if (!req.list || (respectHiddenOption && req.list.get('hidden'))) {
				debug('could not find list ', req.params.list);
				req.flash('error', 'List ' + req.params.list + ' could not be found.');
				return res.redirect('/keystone');
			}

			debug('getting list ', req.params.list);
			next();
		};
	}

	debug('setting keystone Admin Route');
	app.all('/keystone', require('../../admin/routes/views/home'));

	// Email test routes
	if (this.get('email tests')) {
		debug('setting email test routes');
		this.bindEmailTestRoutes(app, this.get('email tests'));
	}

	// Cloudinary API for selecting an existing image / upload a new image
	if (keystone.get('cloudinary config')) {
		debug('setting cloudinary api');
		app.get('/keystone/api/cloudinary/get', require('../../admin/api/cloudinary').get);
		app.get('/keystone/api/cloudinary/autocomplete', require('../../admin/api/cloudinary').autocomplete);
		app.post('/keystone/api/cloudinary/upload', require('../../admin/api/cloudinary').upload);
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

	// Generic Lists API (API for react)
	app.all('/keystone/api/:list/:action(autocomplete|order|create|fetch)', initList(), require('../../admin/api/list'));
	app.post('/keystone/api/:list/delete', initList(), require('../../admin/api/list/delete'));
	app.get('/keystone/api/:list', initList(), require('../../admin/api/list/get'));
	app.get('/keystone/api/:list/:id', initList(), function(req,res,next){
		if (req.list.options.useApi) {
			require('../../admin/api/item/getApi')(req,res,next);
		}
		else{
			require('../../admin/api/item/get')(req,res,next);
		}
		
	});
	app.post('/keystone/api/:list/:id/delete', initList(), require('../../admin/api/item/delete'));
	
	//Prevent access download page if use api
	app.all('/keystone/download/:list', initList(), (req,res,next) => {
		if (req.list.options.useApi){
			req.flash('error', 'Download not supported');
			return res.redirect('/keystone/' + req.list.path);
		}	
		else{
			require('../../admin/api/download')
		}
	});

	// Admin-UI API
	app.all('/keystone/:list',initList(true), require('../../admin/routes/views/list'));
	app.get('/keystone/:list/create',initList(true), require('../../admin/routes/views/itemApi'));
	app.all('/keystone/:list/:item', initList(true), function (req, res, next) {
		if (req.list.options.useApi) {
			require('../../admin/routes/views/itemApi')(req, res, next);
		} else {
			require('../../admin/routes/views/item')(req, res, next);
		}
	});

	return this;
}

module.exports = routes;
