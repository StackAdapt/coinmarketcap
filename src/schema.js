
//----------------------------------------------------------------------------//
// Schemas                                                                    //
//----------------------------------------------------------------------------//

////////////////////////////////////////////////////////////////////////////////

const addSchemas = function (fastify)
{
	ow (fastify, ow.object);

	//----------------------------------------------------------------------------//
	// Platform                                                                   //
	//----------------------------------------------------------------------------//

	fastify.addSchema
	({
		$id: 'platform',

		type:
		[
			'null',
			'object'
		],

		properties:
		{
			id           : { type: 'integer' },
			name         : { type: 'string'  },
			symbol       : { type: 'string'  },
			slug         : { type: 'string'  },
			token_address: { type: 'string'  }
		}
	});



	//----------------------------------------------------------------------------//
	// Quote                                                                      //
	//----------------------------------------------------------------------------//

	fastify.addSchema
	({
		$id: 'quote',
		type: 'object',
		properties:
		{
			price                     : { type: 'number' },
			volume_24h                : { type: 'number' },
			volume_24h_reported       : { type: 'number' },
			volume_7d                 : { type: 'number' },
			volume_7d_reported        : { type: 'number' },
			volume_30d                : { type: 'number' },
			volume_30d_reported       : { type: 'number' },
			market_cap                : { type: 'number' },
			market_cap_by_total_supply: { type: 'number' },
			percent_change_1h         : { type: 'number' },
			percent_change_24h        : { type: 'number' },
			percent_change_7d         : { type: 'number' },
			last_updated              : { type: 'string' }
		}
	});



	//----------------------------------------------------------------------------//
	// Status                                                                     //
	//----------------------------------------------------------------------------//

	fastify.addSchema
	({
		$id: 'status',
		type: 'object',
		properties:
		{
			timestamp    : { type: [ 'string'          ] },
			error_code   : { type: [ 'integer'         ] },
			error_message: { type: [ 'null', 'string'  ] },
			elapsed      : { type: [ 'integer'         ] },
			credit_count : { type: [ 'integer'         ] },
			notice       : { type: [ 'null', 'string'  ] }
		}
	});



	//----------------------------------------------------------------------------//
	// Response                                                                   //
	//----------------------------------------------------------------------------//

	fastify.addSchema
	({
		$id: 'response',
		type: 'object',
		properties:
		{
			status: { $ref: 'status#' }
		}
	});
};



//----------------------------------------------------------------------------//
// Map                                                                        //
//----------------------------------------------------------------------------//

////////////////////////////////////////////////////////////////////////////////

const schemaMap =
{
	//----------------------------------------------------------------------------//
	// Query                                                                      //
	//----------------------------------------------------------------------------//

	querystring:
	{
		type: 'object',
		properties:
		{
			listing_status:
			{
				type: 'string',
				default: 'active'
			},

			start:
			{
				type: 'integer',
				default: 1,
				minimum: 1
			},

			limit:
			{
				type: 'integer',
				default: 1000,
				minimum: 1,
				maximum: 5000
			},

			sort:
			{
				type: 'string',
				default: 'id',
				enum:
				[
					'cmc_rank',
					'id'
				]
			},

			symbol:
			{
				type: 'string'
			},

			aux:
			{
				type: 'string',
				default: 'platform,first_historical_data,last_historical_data,is_active'
			},

			return:
			{
				type: 'integer',
				default: 200,
				// Allows simulation of various errors
				enum: [ 200, 400, 401, 403, 429, 500 ]
			}
		}
	},



	//----------------------------------------------------------------------------//
	// Response                                                                   //
	//----------------------------------------------------------------------------//

	response:
	{
		200:
		{
			type: 'object',
			properties:
			{
				status:
				{
					$ref: 'status#'
				},

				data:
				{
					type: 'array',
					items:
					{
						type: 'object',
						properties:
						{
							id:
							{
								type: 'integer'
							},

							name:
							{
								type: 'string'
							},

							symbol:
							{
								type: 'string'
							},

							slug:
							{
								type: 'string'
							},

							is_active:
							{
								type: 'integer',
								minimum: 0,
								maximum: 1
							},

							rank:
							{
								type: 'integer'
							},

							status:
							{
								type: 'string',
								enum:
								[
									'active',
									'inactive',
									'untracked'
								]
							},

							first_historical_data:
							{
								type: 'string'
							},

							last_historical_data:
							{
								type: 'string'
							},

							platform:
							{
								$ref: 'platform#'
							}
						}
					}
				}
			}
		},

		400: { $ref: 'response#' },
		401: { $ref: 'response#' },
		403: { $ref: 'response#' },
		429: { $ref: 'response#' },
		500: { $ref: 'response#' }
	}
};



//----------------------------------------------------------------------------//
// Quotes                                                                     //
//----------------------------------------------------------------------------//

////////////////////////////////////////////////////////////////////////////////

const schemaQuotes =
{
	//----------------------------------------------------------------------------//
	// Query                                                                      //
	//----------------------------------------------------------------------------//

	querystring:
	{
		type: 'object',
		properties:
		{
			id:
			{
				type: 'string'
			},

			slug:
			{
				type: 'string'
			},

			symbol:
			{
				type: 'string'
			},

			convert:
			{
				type: 'string'
			},

			convert_id:
			{
				type: 'string'
			},

			aux:
			{
				type: 'string',
				default: 'num_market_pairs,cmc_rank,date_added,tags,platform,max_supply,circulating_supply,total_supply,is_active,is_fiat'
			},

			skip_invalid:
			{
				type: 'boolean',
				default: false
			},

			return:
			{
				type: 'integer',
				default: 200,
				// Allows simulation of various errors
				enum: [ 200, 400, 401, 403, 429, 500 ]
			}
		},

		'oneOf':
		[
			{ required: [ 'id'     ] },
			{ required: [ 'slug'   ] },
			{ required: [ 'symbol' ] }
		]
	},



	//----------------------------------------------------------------------------//
	// Response                                                                   //
	//----------------------------------------------------------------------------//

	response:
	{
		200:
		{
			type: 'object',
			properties:
			{
				status:
				{
					$ref: 'status#'
				},

				data:
				{
					type: 'object',
					patternProperties:
					{
						'^[a-zA-Z0-9]+$':
						{
							type: 'object',
							properties:
							{
								id:
								{
									type: 'integer'
								},

								name:
								{
									type: 'string'
								},

								symbol:
								{
									type: 'string'
								},

								slug:
								{
									type: 'string'
								},

								is_active:
								{
									type: 'integer',
									minimum: 0,
									maximum: 1
								},

								is_fiat:
								{
									type: 'integer',
									minimum: 0,
									maximum: 1
								},

								cmc_rank:
								{
									type: 'integer'
								},

								num_market_pairs:
								{
									type: 'integer'
								},

								circulating_supply:
								{
									type: 'number'
								},

								total_supply:
								{
									type: 'number'
								},

								max_supply:
								{
									type: 'number'
								},

								date_added:
								{
									type: 'string'
								},

								tags:
								{
									type: 'array',
									items:
									{
										type: 'string'
									}
								},

								platform:
								{
									$ref: 'platform#'
								},

								last_updated:
								{
									type: 'string'
								},

								quote:
								{
									type: 'object',
									patternProperties:
									{
										'^[a-zA-Z0-9]+$':
										{
											$ref: 'quote#'
										}
									}
								}
							}
						}
					}
				}
			}
		},

		400: { $ref: 'response#' },
		401: { $ref: 'response#' },
		403: { $ref: 'response#' },
		429: { $ref: 'response#' },
		500: { $ref: 'response#' }
	}
};



//----------------------------------------------------------------------------//
// Exports                                                                    //
//----------------------------------------------------------------------------//

module.exports =
{
	addSchemas,
	schemaMap,
	schemaQuotes
};
