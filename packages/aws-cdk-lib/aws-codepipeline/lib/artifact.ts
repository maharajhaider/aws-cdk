import * as validation from './private/validation';
import * as s3 from '../../aws-s3';
import { Lazy, Token, UnscopedValidationError } from '../../core';

/**
 * An output artifact of an action. Artifacts can be used as input by some actions.
 */
export class Artifact {
  /**
   * A static factory method used to create instances of the Artifact class.
   * Mainly meant to be used from `decdk`.
   *
   * @param name the (required) name of the Artifact
   * @param files file paths that you want to export as the output artifact for the action.
   * This property can only be used in the artifact for `CommandsAction`.
   * The length of the files array must be between 1 and 10.
   */
  public static artifact(name: string, files?: string[]): Artifact {
    return new Artifact(name, files);
  }

  private _artifactName?: string;
  private _artifactFiles?: string[];
  private readonly metadata: { [key: string]: any } = {};

  /**
   * An output artifact of an action. Artifacts can be used as input by some actions.
   *
   * @param artifactName the (required) name of the Artifact
   * @param artifactFiles file paths that you want to export as the output artifact for the action.
   * This property can only be used in the artifact for `CommandsAction`.
   * The length of the artifactFiles array must be between 1 and 10.
   */
  constructor(artifactName?: string, artifactFiles?: string[]) {
    validation.validateArtifactName(artifactName);

    if (artifactFiles !== undefined && (artifactFiles.length < 1 || artifactFiles.length > 10)) {
      throw new UnscopedValidationError(`The length of the artifactFiles array must be between 1 and 10, got: ${artifactFiles.length}`);
    }

    this._artifactName = artifactName;
    this._artifactFiles = artifactFiles;
  }

  public get artifactName(): string | undefined {
    return this._artifactName;
  }

  /**
   * The file paths that you want to export as the output artifact for the action.
   *
   * This property can only be used in artifacts for `CommandsAction`.
   */
  public get artifactFiles(): string[] | undefined {
    return this._artifactFiles;
  }

  /**
   * Returns an ArtifactPath for a file within this artifact.
   * CfnOutput is in the form "<artifact-name>::<file-name>"
   * @param fileName The name of the file
   */
  public atPath(fileName: string): ArtifactPath {
    return new ArtifactPath(this, fileName);
  }

  /**
   * The artifact attribute for the name of the S3 bucket where the artifact is stored.
   */
  public get bucketName() {
    return artifactAttribute(this, 'BucketName');
  }

  /**
   * The artifact attribute for The name of the .zip file that contains the artifact that is
   * generated by AWS CodePipeline, such as 1ABCyZZ.zip.
   */
  public get objectKey() {
    return artifactAttribute(this, 'ObjectKey');
  }

  /**
   * The artifact attribute of the Amazon Simple Storage Service (Amazon S3) URL of the artifact,
   * such as https://s3-us-west-2.amazonaws.com/artifactstorebucket-yivczw8jma0c/test/TemplateSo/1ABCyZZ.zip.
   */
  public get url() {
    return artifactAttribute(this, 'URL');
  }

  /**
   * Returns a token for a value inside a JSON file within this artifact.
   * @param jsonFile The JSON file name.
   * @param keyName The hash key.
   */
  public getParam(jsonFile: string, keyName: string) {
    return artifactGetParam(this, jsonFile, keyName);
  }

  /**
   * Returns the location of the .zip file in S3 that this Artifact represents.
   * Used by Lambda's `CfnParametersCode` when being deployed in a CodePipeline.
   */
  public get s3Location(): s3.Location {
    return {
      bucketName: this.bucketName,
      objectKey: this.objectKey,
    };
  }

  /**
   * Add arbitrary extra payload to the artifact under a given key.
   * This can be used by CodePipeline actions to communicate data between themselves.
   * If metadata was already present under the given key,
   * it will be overwritten with the new value.
   */
  public setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  /**
   * Retrieve the metadata stored in this artifact under the given key.
   * If there is no metadata stored under the given key,
   * null will be returned.
   */
  public getMetadata(key: string): any {
    return this.metadata[key];
  }

  public toString() {
    return this.artifactName;
  }

  /** @internal */
  protected _setName(name: string) {
    if (this._artifactName) {
      throw new UnscopedValidationError(`Artifact already has name '${this._artifactName}', cannot override it`);
    } else {
      this._artifactName = name;
    }
  }
}

/**
 * A specific file within an output artifact.
 *
 * The most common use case for this is specifying the template file
 * for a CloudFormation action.
 */
export class ArtifactPath {
  public static artifactPath(artifactName: string, fileName: string): ArtifactPath {
    return new ArtifactPath(Artifact.artifact(artifactName), fileName);
  }

  constructor(readonly artifact: Artifact, readonly fileName: string) {

  }

  public get location() {
    const artifactName = this.artifact.artifactName
      ? this.artifact.artifactName
      : Lazy.string({ produce: () => this.artifact.artifactName });
    return `${artifactName}::${this.fileName}`;
  }
}

function artifactAttribute(artifact: Artifact, attributeName: string) {
  const lazyArtifactName = Lazy.string({ produce: () => artifact.artifactName });
  return Token.asString({ 'Fn::GetArtifactAtt': [lazyArtifactName, attributeName] });
}

function artifactGetParam(artifact: Artifact, jsonFile: string, keyName: string) {
  const lazyArtifactName = Lazy.string({ produce: () => artifact.artifactName });
  return Token.asString({ 'Fn::GetParam': [lazyArtifactName, jsonFile, keyName] });
}
