import React from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Wallet {
  walletId: string;
  walletName: string;
  createdAt: {
    seconds: string;
  };
  updatedAt: {
    seconds: string;
  };
  exported: boolean;
  imported: boolean;
}

interface WalletsProps {
  wallets: Wallet[];
}

const Wallets: React.FC<WalletsProps> = ({ wallets }) => {
  return (
    <div className="p-4">
      <div>Wallets</div>
      <Table>
        <TableCaption>A list of your wallets.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Wallet ID</TableHead>
            <TableHead>Wallet Name</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead>Exported</TableHead>
            <TableHead>Imported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((wallet) => (
            <TableRow key={wallet.walletId}>
              <TableCell>{wallet.walletId}</TableCell>
              <TableCell>{wallet.walletName}</TableCell>
              <TableCell>
                {new Date(
                  parseInt(wallet.createdAt.seconds) * 1000
                ).toLocaleString()}
              </TableCell>
              <TableCell>
                {new Date(
                  parseInt(wallet.updatedAt.seconds) * 1000
                ).toLocaleString()}
              </TableCell>
              <TableCell>{wallet.exported ? "Yes" : "No"}</TableCell>
              <TableCell>{wallet.imported ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Wallets;
