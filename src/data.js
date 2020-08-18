
//----------------------------------------------------------------------------//
// Requires                                                                   //
//----------------------------------------------------------------------------//

const _pick = require ('lodash.pick');



//----------------------------------------------------------------------------//
// Locals                                                                     //
//----------------------------------------------------------------------------//

let mapArr     = null;
let mapArrRank = null;
let mapIdx     = null;

let fiatArr = null;
let fiatIdx = null;

// Random generator
const { MersenneTwister19937, Random } = require ('random-js');
const random = new Random (MersenneTwister19937.autoSeed());



//----------------------------------------------------------------------------//
// Functions                                                                  //
//----------------------------------------------------------------------------//

////////////////////////////////////////////////////////////////////////////////

const _parse = function (file, options = { header: true, skipEmptyLines: true })
{
	ow (file,    ow.string      );
	ow (options, ow.object.plain);

	const path = require ('path'     );
	const papa = require ('papaparse');
	const fs   = require ('fs-extra' );

	// Make the file relative to __dirname
	const f = path.join (__dirname, file);

	// Enable parser to return promises
	return new Promise ((accept, reject) =>
	{
		papa.parse (fs.createReadStream (f),
		{
			...options,
			complete: res => accept (res),
			error   : err => reject (err)
		});
	});
};

////////////////////////////////////////////////////////////////////////////////

const updateQuotes = function()
{
	// Get the current time
	const now = new Date();

	// Create bogus quotes
	const createQuote = () =>
	{
		return {
			price                     : random.real (   0,   10) *   1,
			volume_24h                : random.real (10e6, 15e6) *   1,
			volume_24h_reported       : random.real (15e6, 20e6) *   1,
			volume_7d                 : random.real (10e6, 15e6) *   7,
			volume_7d_reported        : random.real (15e6, 20e6) *   7,
			volume_30d                : random.real (10e6, 15e6) *  30,
			volume_30d_reported       : random.real (15e6, 20e6) *  30,
			market_cap                : random.real (10e7, 40e7) *   1,
			market_cap_by_total_supply: random.real (10e7, 40e7) *   1,
			percent_change_1h         : random.real (-0.3, +0.3) *   1,
			percent_change_24h        : random.real (-0.3, +0.3) *  24,
			percent_change_7d         : random.real (-0.3, +0.3) * 168,
			last_updated              : now.toISOString()
		};
	};

	for (const data of mapArr)
		data.quote = createQuote();

	for (const data of fiatArr)
		data.quote = createQuote();
};

////////////////////////////////////////////////////////////////////////////////

const prepareData = async function()
{
	if (mapArr === null)
	{
		let csvMapData;

		//----------------------------------------------------------------------------//

		try
		{
			// Attempt to load the CSV map database
			csvMapData = await _parse ('./map.csv');

			// Additional parsing errors
			if (csvMapData.errors.length)
				return 'encountered parsing errors';

			// Point directly to the data
			csvMapData = csvMapData.data;
		}

		// Some error has occurred
		catch (err) { return err; }

		//----------------------------------------------------------------------------//

		mapArr = { };
		mapIdx =
		{
			id    : { },
			slug  : { },
			symbol: { }
		};

		const faker = require ('faker');
		// Enforce correct data types
		for (const data of csvMapData)
		{
			let { id, name, symbol, slug, is_active, rank, status } = data;

			id        = parseInt (id,        10) || 0;
			is_active = parseInt (is_active, 10) || 0;
			rank      = parseInt (rank,      10) || null;

			// Bad data input?
			if (!id) continue;

			mapArr[id] =
			// Also create an association with each searchable entity
			mapIdx.id[id] = mapIdx.slug[slug] = mapIdx.symbol[symbol] =
			{
				id, name, symbol, slug, is_active, rank, status,
				first_historical_data: faker.date.past  (),
				 last_historical_data: faker.date.recent(),
				is_fiat              : 0,
				num_market_pairs     : random.integer (4000, 9000) * 1e0,
				circulating_supply   : random.integer (  70,   80) * 1e5,
				total_supply         : random.integer (  80,   90) * 1e5,
				max_supply           : random.integer (  10,   40) * 1e6,
				tags                 : [ ],
				platform             : null,
				last_updated         : faker.date.recent()
			};
		}

		//----------------------------------------------------------------------------//

		// Associate platform objects
		for (const data of csvMapData)
		{
			let { id, platform, token_address } = data;

			id       = parseInt (id,       10) || 0;
			platform = parseInt (platform, 10) || 0;

			// Bad data input?
			if (!id) continue;

			// Retrieve crypto platform
			platform = mapArr[platform];

			// Create platform data if needed
			if (platform) mapArr[id].platform =
			{
				id           : platform.id,
				name         : platform.name,
				symbol       : platform.symbol,
				slug         : platform.slug,
				token_address: token_address
			};
		}

		//----------------------------------------------------------------------------//

		// Convert map data into an array
		mapArr     = Object.values (mapArr);
		mapArrRank = Object.values (mapArr);

		// Sort this value by rank
		mapArrRank.sort ((a, b) =>
		{
			a = a.rank;
			b = b.rank;
			return (a === null) - (b === null) || +(a > b) || -(a < b);
		});
	}

	if (fiatArr === null)
	{
		let csvFiatData;

		//----------------------------------------------------------------------------//

		try
		{
			// Attempt to load the CSV fiat database
			csvFiatData = await _parse ('./fiat.csv');

			// Additional parsing errors
			if (csvFiatData.errors.length)
				return 'encountered parsing errors';

			// Point directly to the data
			csvFiatData = csvFiatData.data;
		}

		// Some error has occurred
		catch (err) { return err; }

		//----------------------------------------------------------------------------//

		fiatArr = { };
		fiatIdx =
		{
			id    : { },
			symbol: { }
		};

		// Enforce correct data types
		for (const data of csvFiatData)
		{
			let { id, symbol, name } = data;

			id = parseInt (id, 10) || 0;

			// Bad data input?
			if (!id) continue;

			// Also create an association with each searchable entity
			fiatArr[id] = fiatIdx.id[id] = fiatIdx.symbol[symbol] =
			{
				id, symbol, name
			};
		}

		//----------------------------------------------------------------------------//

		// Convert fiat data into an array
		fiatArr = Object.values (fiatArr);
	}

	// First update
	updateQuotes();
	return '';
};

////////////////////////////////////////////////////////////////////////////////

const getMap = function ({ listing_status, start, limit, sort, symbol, aux })
{
	// NOTE: Filters are coming from Fastify so don't perform type checking!!

	const result = [ ];
	// Check if all map data is initialized
	if (mapArr === null || fiatArr === null)
		return result;

	// Array of keys to pick from result
	const pick = [ 'id', 'name', 'symbol', 'slug', ...aux.split (',') ];

	if (symbol)
	{
		for (const s of symbol.split (','))
		{
			// If symbol is found
			if (mapIdx.symbol[s])
				result.push (_pick (mapIdx.symbol[s], pick));
		}
	}

	else
	{
		// Split comma-separated values, optimize by using Set
		listing_status = new Set (listing_status.split (','));

		let mapArrVal = mapArr;
		if (sort === 'cmc_rank')
		{
			// Include the rank
			pick.push ('rank');
			mapArrVal = mapArrRank;
		}

		for (const data of mapArrVal)
		{
			// Whether the array limit reached
			if (result.length >= limit) break;

			// Check if status should be included
			if (listing_status.has (data.status))
			{
				// Skip appending until start reached
				if (start > 1) { --start; continue; }

				// Push our data to final result
				result.push (_pick (data, pick));
			}
		}
	}

	return result;
};

////////////////////////////////////////////////////////////////////////////////

const getQuotes = function ({ id, slug, symbol, convert, convert_id, aux, skip_invalid })
{
	// NOTE: Filters are coming from Fastify so don't perform type checking!!

	const result = { };
	// Check if all map data is initialized
	if (mapArr === null || fiatArr === null)
		return result;

	// Array of keys to pick from result
	let pick = [ 'id', 'name', 'symbol', 'slug', 'last_updated', 'quote', ...aux.split (',') ];

	// Quote mandatory
	pick = pick.concat
	([
		'price', 'volume_24h', 'market_cap', 'percent_change_1h',
		'percent_change_24h', 'percent_change_7d', 'last_updated'
	]);

	// Split convert/convert_id depending on what's used
	if (convert   ) convert    = convert   .split (',');
	if (convert_id) convert_id = convert_id.split (',');

	//----------------------------------------------------------------------------//

	// Create a quote object for source entry
	const createQuote = (src, type, value) =>
	{
		const data =
			fiatIdx[type][value] ||
			 mapIdx[type][value];

		if (data)
		{
			const res =
			{
				price                     : data.quote.price                      / src.quote.price,
				volume_24h                : data.quote.volume_24h                 + src.quote.volume_24h                 / 2,
				volume_24h_reported       : data.quote.volume_24h_reported        + src.quote.volume_24h_reported        / 2,
				volume_7d                 : data.quote.volume_7d                  + src.quote.volume_7d                  / 2,
				volume_7d_reported        : data.quote.volume_7d_reported         + src.quote.volume_7d_reported         / 2,
				volume_30d                : data.quote.volume_30d                 + src.quote.volume_30d                 / 2,
				volume_30d_reported       : data.quote.volume_30d_reported        + src.quote.volume_30d_reported        / 2,
				market_cap                : data.quote.market_cap                 + src.quote.market_cap                 / 2,
				market_cap_by_total_supply: data.quote.market_cap_by_total_supply + src.quote.market_cap_by_total_supply / 2,
				percent_change_1h         : data.quote.percent_change_1h          + src.quote.percent_change_1h          / 2,
				percent_change_24h        : data.quote.percent_change_24h         + src.quote.percent_change_24h         / 2,
				percent_change_7d         : data.quote.percent_change_7d          + src.quote.percent_change_7d          / 2,
				last_updated              : data.quote.last_updated
			};

			// Return filtered result
			return _pick (res, pick);
		}

		// If reporting errors
		else if (!skip_invalid)
		{
			const error = new Error();
			error.statusCode = 400;
			error.message = `the convert with value "${value}" is not valid`;
			throw error;
		}
	};

	//----------------------------------------------------------------------------//

	// Create an entry object for result
	const createEntry = (type, value) =>
	{
		// Try and locate specified data
		const data = mapIdx[type][value];

		if (data)
		{
			const res =
			{
				...data, quote: { },
				// These two fields seem to be renamed
				date_added: data.first_historical_data,
				cmc_rank  : data.rank
			};

			if (convert)
			{
				// Create convert quotes
				for (const c of convert)
				{
					const quote = createQuote (data, 'symbol', c);
					// Only append if quote is valid
					if (quote) res.quote[c] = quote;
				}
			}

			else
			{
				if (convert_id)
				{
					// Create convert_id quotes
					for (const c of convert_id)
					{
						const quote = createQuote (data, 'id', c);
						// Only append if quote is valid
						if (quote) res.quote[c] = quote;
					}
				}

				else
				{
					// Create the default USD quote
					const quote = createQuote (data, 'symbol', 'USD');
					// Only append if quote is valid
					if (quote) res.quote.USD = quote;
				}
			}

			// Add res to the combined result
			result[value] = _pick (res, pick);
		}

		// If reporting errors
		else if (!skip_invalid)
		{
			const error = new Error();
			error.statusCode = 400;
			error.message = `the ${type} with value "${value}" is not valid`;
			throw error;
		}
	};

	//----------------------------------------------------------------------------//

	if (id    ) for (const i of id    .split (',')) createEntry ('id',     i);
	if (slug  ) for (const s of slug  .split (',')) createEntry ('slug',   s);
	if (symbol) for (const s of symbol.split (',')) createEntry ('symbol', s);

	//----------------------------------------------------------------------------//

	return result;
};



//----------------------------------------------------------------------------//
// Exports                                                                    //
//----------------------------------------------------------------------------//

module.exports =
{
	prepareData,
	updateQuotes,
	getMap,
	getQuotes
};
