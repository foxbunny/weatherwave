# Notes about the test setup

## API snapshots

The API snapshots are stored in the `tests/fixtures` folder. These snapshots 
are generated using the prototype of the app and will need to be updated 
every time a new field is required.

## Mock date

Because the rendering of the UI is time-sensitive, the tests inject a mock
Date which is fixed at the same time as the first date of the forecasts 
snapshot (`forecastsJson.hourly.time[0]`)
