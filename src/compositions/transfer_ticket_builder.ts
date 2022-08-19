import {
    Builder,
    Address,
    Amount,
    Cell,
    RawTransaction,
    Transaction,
    BuilderOption,
    CellDep,
} from '@lay2/pw-core';
import { addBinary } from 'src/components/utils';

// change all cell's lock and provide fee by self own expense
export class TransferTicketBuilder extends Builder {
    constructor(
        private toAddress: Address,
        private cells: Cell[],
        protected options: BuilderOption = {},
        private cellDeps: CellDep[],
        private state: string = '01',
        private since: string = '0x0'
    ) {
        super(options.feeRate, options.collector, options.witnessArgs);
    }

    // eslint-disable-next-line
    async build(fee: Amount = Amount.ZERO): Promise<Transaction> {
        const inputCells: Cell[] = [];
        const outputCells: Cell[] = [];

        if (this.cells.length === 0) {
            throw new Error('no live cells, not neccessary to change lock');
        }

        for (const cell of this.cells) {
            inputCells.push(cell);
            const data = cell.getHexData().slice(2);
            const start = data.slice(0, 20);
            const end = data.slice(22);
            const stateBin = parseInt(`0x${data.slice(20, 22)}`, 16).toString(
                2
            );
            let state = data.slice(20, 22);
            if (this.state === '02') {
                state = addBinary(stateBin, '10');
            } else {
                if (state === '00') {
                    state = addBinary(stateBin, '1');
                }
            }
            const outData = `0x${start}${state}${end}`;

            const outputCell = cell.clone();
            outputCell.lock = this.toAddress.toLockScript();
            outputCell.setHexData(outData);
            outputCells.push(outputCell);
            console.log('input', cell.getHexData());
            console.log(
                'output',
                outputCell.getHexData(),
                'this.state',
                this.state
            );
        }

        const rawTx = new RawTransaction(
            inputCells,
            outputCells,
            this.cellDeps
        );

        for (let i = 0; i < rawTx.inputs.length - 1; i++) {
            rawTx.inputs[i].since = this.since;
        }
        const tx = new Transaction(rawTx, [this.witnessArgs]);
        this.fee = Builder.calcFee(tx, this.feeRate);
        console.log(fee);
        const changeCell = tx.raw.outputs.pop() as Cell;
        changeCell.capacity = changeCell.capacity.sub(this.fee);
        tx.raw.outputs.push(changeCell);
        return tx;
    }

    getCollector() {
        return this.collector;
    }
}
