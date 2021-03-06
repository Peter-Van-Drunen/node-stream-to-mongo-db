/* global beforeEach, afterAll, expect, it, describe */
import MongoDB         from 'mongodb';
import fs              from 'fs';
import path            from 'path';
import JSONStream      from 'JSONStream';
import StreamToMongoDB from '../index';

const INSERT_DATA_FILE_LOCATION = path.resolve('src/spec/support/insertData.json');
const UPDATE_DATA_FILE_LOCATION = path.resolve('src/spec/support/updateData.json');
const UPDATE_DATA_FILE_VALUE = 1337;

const testDB = 'streamToMongoDB';
const testConfig = { dbURL: `mongodb://localhost:27017/${testDB}`, collection: 'test' };

const expectedNumberOfRecords = require('./support/insertData.json').length;

describe('.streamToMongoDB', () => {
  beforeEach(async (done) => {
    await clearDB();
    done();
  });

  afterAll(async (done) => {
    await clearDB();
    done();
  });

  // insert basic
  describe('with no given options', () => {
    it('uses the default config to insert the expected number of documents to MongoDB', async (done) => {
      runInsertStream(testConfig, done);
    });
  });

  // update basic
  describe('with no given options for an update', () => {
    it('uses the default config to update the records in the db', async (done) => {
      runUpdateStream(testConfig, done);
    });
  });

  // inserts with options
  describe('inserts with given options', () => {
    describe('with batchSize same as the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords;
        runInsertStream(testConfig, done);
      });
    });

    describe('with batchSize less than number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords - 3;
        runInsertStream(testConfig, done);
      });
    });

    describe('with batchSize more than the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords * 100;
        runInsertStream(testConfig, done);
      });
    });
  });

  // updates with options
  describe('updates with given options', () => {
    describe('with batchSize same as the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords;
        runUpdateStream(testConfig, done);
      });
    });

    describe('with batchSize less than number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords - 3;
        runUpdateStream(testConfig, done);
      });
    });

    describe('with batchSize more than the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords * 100;
        runUpdateStream(testConfig, done);
      });
    });
  });

  // deletes with options
  describe('deletes with given options', () => {
    describe('with batchSize same as the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords;
        runDeleteStream(testConfig, done);
      });
    });

    describe('with batchSize less than number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords - 3;
        runDeleteStream(testConfig, done);
      });
    });

    describe('with batchSize more than the number of documents to be streamed', () => {
      it('it streams the expected number of documents to MongoDB', (done) => {
        testConfig.batchSize = expectedNumberOfRecords * 100;
        runDeleteStream(testConfig, done);
      });
    });
  });
});

const connect = () => MongoDB.MongoClient.connect(testConfig.dbURL);

const runInsertStream = (config, done) => {
  fs.createReadStream(INSERT_DATA_FILE_LOCATION)
    .pipe(JSONStream.parse('*'))
    .pipe(StreamToMongoDB.streamToMongoDB(config))
    .on('error', (err) => {
      done.fail(err);
    })
    .on('close', () => {
      ensureAllDocumentsInserted(config, done);
    });
};

const ensureAllDocumentsInserted = async (config, done) => {
  const db = await connect();
  const count = await db.collection(config.collection).count();
  await db.close();
  expect(count).toEqual(expectedNumberOfRecords);
  done();
};

const runUpdateStream = (config, done) => {
  fs.createReadStream(INSERT_DATA_FILE_LOCATION)
    .pipe(JSONStream.parse('*'))
    .pipe(StreamToMongoDB.streamToMongoDB(config))
    .on('error', (err) => {
      done.fail(err);
    })
    .on('close', () => {
      updateAllDocuments(config, done);
    });
};

const updateAllDocuments = (config, done) => {
  // update every document to have the same total
  const options = Object.assign(
    {},
    config,
    {
      operationType: 'update',
      indexName: 'secret'
    }
  );
  fs.createReadStream(UPDATE_DATA_FILE_LOCATION)
    .pipe(JSONStream.parse('*'))
    .pipe(StreamToMongoDB.streamToMongoDB(options))
    .on('error', (err) => {
      done.fail(err);
    })
    .on('close', () => {
      ensureAllDocumentsUpdated(config, done);
    });
};

const ensureAllDocumentsUpdated = async (config, done) => {
  const db = await connect();
  const data = await db.collection(config.collection).find({}).toArray();
  data.forEach((d) => { expect(d.total).toEqual(UPDATE_DATA_FILE_VALUE); });
  await db.close();
  done();
};

const runDeleteStream = (config, done) => {
  fs.createReadStream(INSERT_DATA_FILE_LOCATION)
    .pipe(JSONStream.parse('*'))
    .pipe(StreamToMongoDB.streamToMongoDB(config))
    .on('error', (err) => {
      done.fail(err);
    })
    .on('close', () => {
      deleteAllDocuments(config, done);
    });
};

const deleteAllDocuments = (config, done) => {
  // update every document to have the same total
  const options = Object.assign(
    {},
    config,
    {
      operationType: 'delete',
      indexName: 'secret'
    }
  );
  fs.createReadStream(UPDATE_DATA_FILE_LOCATION)
    .pipe(JSONStream.parse('*'))
    .pipe(StreamToMongoDB.streamToMongoDB(options))
    .on('error', (err) => {
      done.fail(err);
    })
    .on('close', () => {
      ensureAllDocumentsDeleted(config, done);
    });
};

const ensureAllDocumentsDeleted = async (config, done) => {
  const db = await connect();
  const count = await db.collection(config.collection).count();
  expect(count).toEqual(0);
  await db.close();
  done();
};

const clearDB = async () => {
  const dbConnection = await connect();
  await dbConnection.dropDatabase();
  await dbConnection.close();
};
