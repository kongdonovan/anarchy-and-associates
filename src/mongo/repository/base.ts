import {
  Collection,
  DeleteResult,
  Document,
  Filter,
  InsertOneResult,
  ObjectId,
  OptionalUnlessRequiredId,
  UpdateResult,
  WithId,
} from "mongodb";
import clientPromise from "../mongo.js";

/**
 * BaseRepository provides generic CRUD operations for MongoDB collections.
 * @template T Document type
 */
export abstract class BaseRepository<T extends Document> {
  private readonly collectionPromise: Promise<Collection<T>>;

  protected constructor(
    private readonly collectionName: string,
    private readonly dbName = "anarchy-and-associates",
  ) {
    this.collectionPromise = clientPromise.then((client) =>
      client.db(this.dbName).collection<T>(this.collectionName),
    );
  }

  /** Lazily resolve the collection */
  private async col() {
    return this.collectionPromise;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Find a document by its MongoDB ObjectId (as string)
   */
  async findById(id: string) {
    return (await this.col()).findOne({ _id: new ObjectId(id) } as Filter<T>);
  }

  /**
   * Find documents by filter, with optional limit/skip/sort
   */
  async findByFilters(
    filters: Filter<T>,
    options: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
    } = {},
  ): Promise<WithId<T>[]> {
    const { limit, skip, sort } = options;
    const cursor = (await this.col())
      .find(filters)
      .limit(limit ?? 0)
      .skip(skip ?? 0)
      .sort(sort ?? {});
    return cursor.toArray();
  }

  /**
   * Insert a new document
   */
  async insert(doc: OptionalUnlessRequiredId<T>): Promise<InsertOneResult<T>> {
    return (await this.col()).insertOne(doc);
  }

  /**
   * Update a document by its MongoDB ObjectId (as string)
   */
  async update(documentId: string, updates: Partial<T>): Promise<UpdateResult<T>> {
    return (await this.col()).updateOne(
      { _id: new ObjectId(documentId) } as Filter<T>,
      { $set: updates },
    );
  }

  /**
   * Perform a raw update with any MongoDB update operator
   */
  async updateWithOperator(documentId: string, update: any): Promise<UpdateResult<T>> {
    return (await this.col()).updateOne(
      { _id: new ObjectId(documentId) } as Filter<T>,
      update,
    );
  }

  /**
   * Delete a document by its MongoDB ObjectId (as string)
   */
  async delete(documentId: string): Promise<DeleteResult> {
    return (await this.col()).deleteOne(
      { _id: new ObjectId(documentId) } as Filter<T>,
    );
  }

  /**
   * Delete all documents in the collection
   */
  async deleteAll(): Promise<DeleteResult> {
    return (await this.col()).deleteMany({});
  }

  /**
   * Delete all documents matching filters
   */
  async deleteByFilters(filters: Filter<T>) {
    return (await this.col()).deleteMany(filters);
  }

  /**
   * Update a document and return the updated document (atomic in MongoDB 4.2+)
   */
  async updateAndReturn(documentId: string, updates: Partial<T>): Promise<WithId<T> | null> {
    const result = await (await this.col()).findOneAndUpdate(
      { _id: new ObjectId(documentId) } as Filter<T>,
      { $set: updates },
      { returnDocument: "after" }
    );
    if (!result) return null;
    return result.value ?? null;
  }
}
