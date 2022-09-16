import { Medallion, Timestamp, Address, CommitInfo } from "./typedefs";
import { ChangeSet as ChangeSetBuilder } from "change_set_pb";
import { Change as ChangeBuilder } from "change_pb";
import { Entry as EntryBuilder } from "entry_pb";
import { Container as ContainerBuilder } from "container_pb";

export class ChangeSet {
    // note: this class is unit tested as part of Store.test.ts
    private commitInfo: CommitInfo | null = null;
    private serialized: Uint8Array | null = null;
    private changeSetMessage = new ChangeSetBuilder();
    private countItems = 0;
 
    constructor(private pendingComment?: string, readonly preAssignedMedallion?: Medallion) { 
    }

    requireNotSealed() {
        if (this.commitInfo)
            throw new Error("This ChangeSet has already been sealed.");
    }

    set comment(value) {
        this.requireNotSealed();
        this.pendingComment = value;
    }

    get comment(): string {
        return this.pendingComment || this.commitInfo?.comment;
    }

    get medallion(): Medallion | undefined {
        return this.preAssignedMedallion || this.commitInfo?.medallion;
    }

    get timestamp(): Timestamp | undefined {
        return this.commitInfo?.timestamp;
    }

    addEntry(entryBuilder: EntryBuilder): Address {
        return this.addChange((new ChangeBuilder()).setEntry(entryBuilder));
    }

    addContainer(containerBuilder: ContainerBuilder) {
        return this.addChange((new ChangeBuilder()).setContainer(containerBuilder));
    }

    /**
     * 
     * @param changeBuilder a protobuf Change ready to be serialized
     * @returns an Address who's offset is immediately available and whose medallion and
     * timestamp become defined when this ChangeSet is sealed.
     */
    addChange(changeBuilder: ChangeBuilder): Address {
        this.requireNotSealed();
        const offset = ++this.countItems;
        this.changeSetMessage.getChangesMap().set(offset, changeBuilder);
        return new class {
            constructor(private changeSet: ChangeSet, readonly offset: number) {}
            get medallion() { return this.changeSet.medallion; }
            get timestamp() { return this.changeSet.timestamp; }
        }(this, offset);
    }

    removeChange(address: Address) {
        this.requireNotSealed();
        const map = this.changeSetMessage.getChangesMap();
        map.delete(address.offset);
    }


    /**
     * Intended to be called by a GinkInstance to finalize a commit.
     * @param commitInfo the commit metadata to add when serializing
     * @returns serialized 
     */
    seal(commitInfo: CommitInfo) {
        this.requireNotSealed();
        if (this.preAssignedMedallion && this.preAssignedMedallion != commitInfo.medallion) {
            throw new Error("specifed commitInfo doesn't match pre-assigned medallion");
        }
        this.commitInfo = {...commitInfo};
        this.commitInfo.comment = this.pendingComment;
        this.changeSetMessage.setTimestamp(commitInfo.timestamp);
        this.changeSetMessage.setPreviousTimestamp(commitInfo.priorTime);
        this.changeSetMessage.setChainStart(commitInfo.chainStart);
        this.changeSetMessage.setMedallion(commitInfo.medallion);
        this.changeSetMessage.setComment(this.commitInfo.comment);
        this.serialized = this.changeSetMessage.serializeBinary();
        return this.serialized;
    }
}
