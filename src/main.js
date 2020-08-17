
//----------------------------------------------------------------------------//
// Requires                                                                   //
//----------------------------------------------------------------------------//

// Registers all our module aliases
require ('module-alias').addAliases
({
	'@root': `${process.cwd()}`,
	'@main': `${process.cwd()}/src`
});

// Simplify type validation
global.ow = require ('ow');

const {
	addSchemas,
	schemaMap,
	schemaQuotes

} = require ('@main/schema');

const {
	prepareData,
	updateQuotes,
	getMap,
	getQuotes

} = require ('@main/data');



//----------------------------------------------------------------------------//
// Locals                                                                     //
//----------------------------------------------------------------------------//

// Replacing default logger
let oldConsole = undefined;

// Fastify instance
let fastify = null;

// ID for updating the quotes
let updateQuotesInterval = 0;



//----------------------------------------------------------------------------//
// Functions                                                                  //
//----------------------------------------------------------------------------//

////////////////////////////////////////////////////////////////////////////////

const captureConsole = function (f)
{
	ow (f, ow.object);
	// If the console is captured
	if (oldConsole === undefined)
	{
		oldConsole =
		{
			fatal: console.fatal,
			error: console.error,
			warn : console.warn,
			info : console.info,
			debug: console.debug,
			trace: console.trace
		};

		// Detour the console methods to use Fastify logger
		console.fatal = (...args) => f.log.fatal (...args);
		console.error = (...args) => f.log.error (...args);
		console.warn  = (...args) => f.log.warn  (...args);
		console.info  = (...args) => f.log.info  (...args);
		console.debug = (...args) => f.log.debug (...args);
		console.trace = (...args) => f.log.trace (...args);
	}
};

////////////////////////////////////////////////////////////////////////////////

const releaseConsole = function()
{
	// If the console is captured
	if (oldConsole !== undefined)
	{
		// Restore default console methods
		console.fatal = oldConsole.fatal;
		console.error = oldConsole.error;
		console.warn  = oldConsole.warn;
		console.info  = oldConsole.info;
		console.debug = oldConsole.debug;
		console.trace = oldConsole.trace;

		// Release the console
		oldConsole = undefined;
	}
};

////////////////////////////////////////////////////////////////////////////////

const gracefulExit = async function (code = 0)
{
	// NOTE: Typechecking too risky!!

	// Attempt to shut down gracefully
	if (fastify) await fastify.close();

	// Cancel scheduled quote updating
	clearInterval (updateQuotesInterval);
	updateQuotesInterval = 0;

	// Stop detouring
	releaseConsole();

	// Set process exit code if needed
	if (code) process.exitCode = code;

};

////////////////////////////////////////////////////////////////////////////////

const setupErrors = function()
{
	const PrettyError = require ('pretty-error');

	// Make default pretty error instance
	const prettyError = new PrettyError();

	// Prevent Node from crashing due to an exception
	process.on ('uncaughtException', async error =>
	{
		await gracefulExit (1);
		// Output the error with improved rendering
		console.error (prettyError.render (error));
	});

	// Prevent Node from crashing due to missing catch
	process.on ('unhandledRejection', async error =>
	{
		await gracefulExit (1);
		// Output the error with improved rendering
		console.error (prettyError.render (error));
	});
};

////////////////////////////////////////////////////////////////////////////////

const setupInterrupts = function()
{
	let sigint = 0;
	// Detect when shutdown requested
	process.on ('SIGINT', async () =>
	{
		if (sigint++ > 0)
		{
			// Terminate on multiple triggers (backup)
			console.warn ('forcefully terminating...');
			process.exit (1);
		}

		console.info ('graceful shutdown requested...');
		// Attempt shutdown
		await gracefulExit();
	});
};

////////////////////////////////////////////////////////////////////////////////

const setupServer = function()
{
	const logger =
		// Reduce log verbosity in production
		process.env.NODE_ENV === 'production' ?
		{
			level: 'warn'
		} :
		{
			level: 'info',
			prettyPrint: true
		};

	// Create instance of Fastify
	const f = require ('fastify')
	({
		ignoreTrailingSlash: true,
		logger
	});

	// Register several useful Fastify plugins
	f.register (require ('fastify-sensible'),
	{
		// Using custom one
		errorHandler: false
	});

	// Add schemas
	addSchemas (f);

	// Return
	return f;
};

////////////////////////////////////////////////////////////////////////////////

const codeToMessage = function (code)
{
	ow (code, ow.number.integer);

	switch (code)
	{
		case 400: return 'Looks like you sent a request that this server could not understand.';
		case 401: return 'Looks like you are not authorized to perform the specified request.';
		case 403: return 'Looks like you are not authorized to perform the specified request.';
		case 429: return 'It appears that you are making too many requests, please wait a bit.';
		case 500: return 'Looks like something went wrong on our end, please try again later.';
	}

	return null;
};

////////////////////////////////////////////////////////////////////////////////

const createStatus = function (code, message, elapsed = 0, credits = 0)
{
	ow (code,    ow.number.integer);
	ow (elapsed, ow.number.integer);
	ow (credits, ow.number.integer);
	ow (message, ow.any (ow.null, ow.string));

	// Get the current time
	const now = new Date();

	// 200 is considered success
	if (code === 200) code = 0;

	return {
		timestamp    : now.toISOString(),
		error_code   : code,
		error_message: message,
		elapsed      : elapsed,
		credit_count : credits,
		notice       : null
	};
};

////////////////////////////////////////////////////////////////////////////////

const dataRequest = function (req, res, fn)
{
	ow (fn, ow.function);
	// Retrieve start time of the request
	const start = process.hrtime.bigint();

	const result = { };
	// Shortcut to a response code
	const code = req.query.return;

	// Send a success
	if (code === 200)
	{
		result.data = fn (req.query);
	}

	else
	{
		// Send a failure
		if (code === 500)
		{
			throw new Error ('boom');
		}
	}

	const elapsed = Math.round (Number (
		// Compute request elapsed time
		process.hrtime.bigint() - start
	) / 1e6);

	// Attach the status to result
	result.status = createStatus (
		code, codeToMessage (code), elapsed, code === 200 ? 1 : 0
	);

	// Return result of the request
	res.status (code).send (result);
};



//----------------------------------------------------------------------------//
// Main                                                                       //
//----------------------------------------------------------------------------//

module.exports.main = async function()
{
	//----------------------------------------------------------------------------//

	setupErrors    ();
	setupInterrupts();

	// Create Fastify server
	fastify = setupServer();

	// Detour console logging
	captureConsole (fastify);

	//----------------------------------------------------------------------------//

	// Attempt to load and prepare static data
	const prepareResult = await prepareData();

	// Check for error
	if (prepareResult)
	{
		console.error ('error preparing data');
		console.error (prepareResult);
		return await gracefulExit (1);
	}

	// Begin simulating some updating of base currency prices
	updateQuotesInterval = setInterval (updateQuotes, 60000);

	//----------------------------------------------------------------------------//

	fastify.setErrorHandler ((error, req, res) =>
	{
		const result = { };
		// Shortcut to the response code
		const code = res.raw.statusCode;

		if (code === 500 &&
			// Prevent leaking internal error messages
			error.explicitInternalServerError !== true)
		{
			console.error (error);
			// Attach the status to result
			result.status = createStatus (
				code, codeToMessage (code)
			);
		}

		else
		{
			// Attach the status to result
			result.status = createStatus (
				code, error.message
			);
		}

		// Return result
		res.send (result);
	});

	//----------------------------------------------------------------------------//

	fastify.get ('/coinmarketcap/map',
	{
		// Use map schema
		schema: schemaMap

	}, (req, res) =>
	{
		// Perform data request for map
		dataRequest (req, res, getMap);
	});

	//----------------------------------------------------------------------------//

	fastify.get ('/coinmarketcap/quotes',
	{
		// Use quotes schema
		schema: schemaQuotes

	}, (req, res) =>
	{
		// Perform data request for quotes
		dataRequest (req, res, getQuotes);
	});

	//----------------------------------------------------------------------------//

	try
	{
		// Attempt to start server on the port
		await fastify.listen (2266, '0.0.0.0');
	}

	catch (err)
	{
		// Log and terminate
		console.error (err);
		return await gracefulExit (1);
	}

	//----------------------------------------------------------------------------//
};
