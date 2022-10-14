import { ChangeSet } from "./ChangeSet";
import { Entry as EntryBuilder } from "entry_pb";
import { Basic, KeyType, Muid, Bytes } from "./typedefs";
import { muidToBuilder, wrapValue, unwrapValue, builderToMuid } from "./utils";
import { Change as ChangeBuilder } from "change_pb";
import { Container as ContainerBuilder } from "container_pb";
import { Deletion } from "./Deletion";
import { ensure } from "./utils";
import { Directory } from "./Directory";
import { GinkInstance } from "./GinkInstance";


export class Container {
    readonly initialized: Promise<void>;
    protected static readonly DELETION = new Deletion();

    static async construct(ginkInstance: GinkInstance, address?: Muid, containerBuilder?: ContainerBuilder): Promise<Container> {
        if (!containerBuilder) {
            const containerBytes = ensure(await ginkInstance.store.getContainerBytes(address));
            containerBuilder = ContainerBuilder.deserializeBinary(containerBytes);
        }
        if (containerBuilder.getBehavior() == ContainerBuilder.Behavior.SCHEMA) {
            return (new Directory(ginkInstance, address, containerBuilder));
        }
        throw new Error(`container type not recognized/implemented: ${containerBuilder.getBehavior()}`);
    }

    /**
     * 
     * @param ginkInstance required
     * @param address not necessary for root schema
     * @param containerBuilder will try to fetch if not specified
     */
    protected constructor(readonly ginkInstance: GinkInstance, readonly address?: Muid,
        protected containerBuilder?: ContainerBuilder) {
        ensure(containerBuilder || !address);
        this.initialized = ginkInstance.initialized;
    }

    protected async convertEntryBytes(entryBytes: Bytes, entryAddress?: Muid) {
        const entryBuilder = EntryBuilder.deserializeBinary(entryBytes);
        if (entryBuilder.hasValue()) {
            // console.log("found value");
            return unwrapValue(entryBuilder.getValue());
        }
        if (entryBuilder.hasDestination()) {
            // console.log("found dest")
            const destAddress = builderToMuid(entryBuilder.getDestination(), entryAddress)
            return await Container.construct(this.ginkInstance, destAddress);
        }
        if (entryBuilder.hasDeleting() && entryBuilder.getDeleting()) {
            // console.log("found deleting");
            return undefined;
        }
        throw new Error("unsupported entry type");
    }

    protected async getEntry(key?: KeyType): Promise<[Muid | undefined, Container | Basic | undefined]> {
        await this.initialized;
        const result = await this.ginkInstance.store.getEntry(this.address, key);
        if (!result) {
            // console.log("no entries found in store");
            return [undefined, undefined];
        }
        const [entryAddress, entryBytes] = result;
        return [entryAddress, await this.convertEntryBytes(entryBytes, entryAddress)];
    }

    protected async addEntry(key?: KeyType, value?: Basic | Container | Deletion, changeSet?: ChangeSet): Promise<Muid> {
        await this.initialized;
        let immediate: boolean = false;
        if (!changeSet) {
            immediate = true;
            changeSet = new ChangeSet();
        }

        const entry = new EntryBuilder();
        if (this.address) {
            entry.setSource(muidToBuilder(this.address, changeSet.medallion));
        }
        // TODO: check the key against the ValueType for keys (if set)
        if (key)
            entry.setKey(wrapValue(key));

        // TODO: check that the destination/value is compatible with Container
        if (value !== undefined) {
            if (value instanceof Container) {
                entry.setDestination(muidToBuilder(value.address, changeSet.medallion));
            } else if (value instanceof Deletion) {
                entry.setDeleting(true);
            } else {
                entry.setValue(wrapValue(value));
            }

        }
        const change = new ChangeBuilder();
        change.setEntry(entry);
        const address = changeSet.addChange(change);
        if (immediate) {
            await this.ginkInstance.addChangeSet(changeSet);
        }
        return address;
    }

}
