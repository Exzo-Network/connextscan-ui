import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { useSelector, shallowEqual } from 'react-redux'
import _ from 'lodash'
import { Contract, constants, utils } from 'ethers'
import { TailSpin, Watch } from 'react-loader-spinner'
import { BiMessageError, BiMessageCheck, BiX } from 'react-icons/bi'

import Notification from '../notifications'
import Modal from '../modals'
import Wallet from '../wallet'
import Copy from '../copy'
import EnsProfile from '../ens-profile'
import { number_format, ellipse, loader_color } from '../../lib/utils'

export default () => {
  const {
    preferences,
    chains,
    assets,
    rpc_providers,
    dev,
    wallet,
  } = useSelector(state =>
    (
      { preferences: state.preferences,
        chains: state.chains,
        assets: state.assets,
        rpc_providers: state.rpc_providers,
        dev: state.dev,
        wallet: state.wallet,
      }
    ),
    shallowEqual,
  )
  const {
    theme,
  } = { ...preferences }
  const {
    chains_data,
  } = { ...chains }
  const {
    assets_data,
  } = { ...assets }
  const {
    rpcs,
  } = { ...rpc_providers }
  const {
    sdk,
  } = { ...dev }
  const {
    wallet_data,
  } = { ...wallet }
  const {
    web3_provider,
    signer,
  } = { ...wallet_data }

  const wallet_chain_id = wallet_data?.chain_id
  const wallet_address = wallet_data?.address

  const router = useRouter()
  const {
    query,
    asPath,
  } = { ...router }
  const {
    address,
  } = { ...query }

  const [hidden, setHidden] = useState(true)
  const [data, setData] = useState(null)
  const [balance, setBalance] = useState(null)

  const [approving, setApproving] = useState(null)
  const [approveProcessing, setApproveProcessing] = useState(null)
  const [approveResponse, setApproveResponse] = useState(null)

  const [adding, setAdding] = useState(null)
  const [addProcessing, setAddProcessing] = useState(null)
  const [addResponse, setAddResponse] = useState(null)

  useEffect(() => {
    const {
      chain,
    } = { ...data }

    if (
      chains_data &&
      assets_data &&
      !chain
    ) {
      const chain_data = _.head(chains_data)
      const {
        id,
        chain_id,
      } = { ...chain_data }

      setData(
        {
          ...data,
          chain: id,
          asset:
            _.head(
              assets_data
                .filter(a =>
                  (a?.contracts || [])
                    .findIndex(c =>
                      c?.chain_id === chain_id &&
                      (
                        c?.next_asset?.contract_address ||
                        c?.contract_address
                      )
                    ) > -1
                )
            )?.id,
        }
      )
    }
  }, [chains_data, assets_data, data])

  useEffect(() => {
    const getData = async () => {
      const {
        chain,
        asset,
      } = { ...data }

      if (
        chains_data &&
        assets_data &&
        chain &&
        data.asset &&
        wallet_address
      ) {
        const chain_data = chains_data
          .find(c =>
            c?.id === chain
          )
        const {
          chain_id,
        } = { ...chain_data }

        const asset_data = assets_data
          .find(a =>
            a?.id === asset
          )
        const {
          contracts,
        } = { ...asset_data }

        const contract_data = (contracts || [])
          .find(c =>
            c?.chain_id === chain_id
          )
        const {
          next_asset,
        } = { ...contract_data }
        let {
          contract_address,
          decimals,
        } = { ...contract_data }

        contract_address =
          next_asset?.contract_address ||
          contract_address

        decimals =
          next_asset?.decimals ||
          decimals

        const provider = rpcs?.[chain_id]

        let balance

        if (
          provider &&
          contract_address
        ) {
          if (contract_address === constants.AddressZero) {
            balance =
              await provider
                .getBalance(
                  wallet_address,
                )
          }
          else {
            const contract =
              new Contract(
                contract_address,
                [
                  'function balanceOf(address owner) view returns (uint256)',
                ],
                provider,
              )

            balance =
              await contract
                .balanceOf(
                  wallet_address,
                )
          }
        }

        if (balance) {
          setBalance(
            Number(
              utils.formatUnits(
                balance,
                decimals ||
                18,
              )
            )
          )
        }
      }
      else {
        setBalance(null)
      }
    }

    getData()
  }, [chains_data, assets_data, rpcs, data, wallet_address, adding])

  const reset = () => {
    setData(null)

    setApproving(null)
    setApproveProcessing(null)

    setAdding(null)
    setAddProcessing(null)
  }

  const addLiquidty = async () => {
    if (
      chains_data &&
      sdk &&
      signer &&
      data
    ) {
      setApproving(null)
      setAdding(true)

      const {
        chain,
        asset,
        amount,
      } = { ...data }

      const chain_data = chains_data
        .find(c =>
          c?.id === chain
        )
      const {
        chain_id,
        domain_id,
      } = { ...chain_data }

      const asset_data = (assets_data || [])
        .find(a =>
          a?.id === asset
        )
      const {
        contracts,
      } = { ...asset_data }

      const contract_data = (contracts || [])
        .find(c =>
          c?.chain_id === chain_id
        )
      const {
        next_asset,
      } = { ...contract_data }
      let {
        contract_address,
        decimals,
        symbol,
      } = { ...contract_data }

      contract_address =
        next_asset?.contract_address ||
        contract_address

      decimals =
        next_asset?.decimals ||
        decimals ||
        18

      symbol =
        next_asset?.symbol ||
        symbol ||
        asset_data?.symbol

      const addParams = {
        domain: domain_id,
        amount:
          utils.parseUnits(
            (
              amount ||
              0
            )
            .toString(),
            decimals,
          )
          .toString(),
        assetId: contract_address,
        router: address,
      }

      let failed = false

      try {
        const approve_request =
          await sdk.nxtpSdkBase
            .approveIfNeeded(
              addParams.domain,
              addParams.assetId,
              addParams.amount,
              false,
            )

        if (approve_request) {
          setApproving(true)

          const approve_response =
            await signer
              .sendTransaction(
                approve_request,
              )

          const {
            hash,
          } = { ...approve_response }

          setApproveResponse(
            {
              status: 'pending',
              message: `Wait for ${symbol} approval`,
              tx_hash: hash,
            }
          )
          setApproveProcessing(true)

          const approve_receipt =
            await signer.provider
              .waitForTransaction(
                hash,
              )

          const {
            status,
          } = { ...approve_receipt }

          setApproveResponse(
            status ?
              null :
              {
                status: 'failed',
                message: `Failed to approve ${symbol}`,
                tx_hash: hash,
              }
          )

          failed = !status

          setApproveProcessing(false)
          setApproving(false)
        }
        else {
          setApproving(false)
        }
      } catch (error) {
        setApproveResponse(
          {
            status: 'failed',
            message:
              error?.data?.message ||
              error?.message,
          }
        )

        failed = true

        setApproveProcessing(false)
        setApproving(false)
      }

      if (!failed) {
        try {
          const add_request =
            await sdk.nxtpSdkRouter
              .addLiquidityForRouter(
                addParams,
              )

          if (add_request) {
            const add_response =
              await signer
                .sendTransaction(
                  add_request,
                )

            const {
              hash,
            } = { ...add_response }

            setAddResponse(
              {
                status: 'pending',
                message: `Wait for adding ${symbol} liquidity`,
                tx_hash: hash,
              }
            )
            setAddProcessing(true)

            const add_receipt =
              await signer.provider
                .waitForTransaction(
                  hash,
                )

            const {
              status,
            } = { ...add_receipt }

            failed = !status

            setAddResponse(
              {
                status: failed ?
                  'failed' :
                  'success',
                message: failed ?
                  `Failed to add ${symbol} liquidity` :
                  `Add ${symbol} liquidity successful`,
                tx_hash: hash,
              }
            )

            if (!failed) {
              router.push(`${asPath}?action=refresh`)
            }
          }
        } catch (error) {
          setAddResponse(
            {
              status: 'failed',
              message:
                error?.data?.message ||
                error?.message,
            }
          )

          failed = true
        }
      }

      setAddProcessing(false)
      setAdding(false)
    }
  }

  const {
    chain,
    amount,
  } = { ...data }

  const chain_data = (chains_data || [])
    .find(c =>
      c?.id === chain
    )
  const {
    chain_id,
    explorer,
  } = { ...chain_data }
  const {
    url,
    transaction_path,
  } = { ...explorer }

  const fields =
    [
      {
        label: 'Chain',
        name: 'chain',
        type: 'select',
        placeholder: 'Select chain',
        options:
          (chains_data || [])
            .filter(c => !c?.view_only)
            .map(c => {
              const {
                id,
                name,
              } = { ...c }

              return {
                value: id,
                title: name,
                name,
              }
            }),
      },
      {
        label: 'Asset',
        name: 'asset',
        type: 'select',
        placeholder: 'Select asset',
        options:
          (assets_data || [])
            .filter(a =>
              !chain ||
              (a?.contracts || [])
                .findIndex(c =>
                  c?.chain_id === chain_id &&
                  (
                    c?.next_asset?.contract_address ||
                    c?.contract_address
                  )
                ) > -1
            )
            .map(a => {
              const {
                id,
                name,
                contracts,
              } = { ...a }

              const contract_data = (contracts || [])
                .find(c =>
                  c?.chain_id === chain_id
                )
              const {
                next_asset,
              } = { ...contract_data }
              let {
                contract_address,
                symbol,
              } = { ...contract_data }

              contract_address =
                next_asset?.contract_address ||
                contract_address

              symbol =
                next_asset?.symbol ||
                symbol ||
                a?.symbol

              return {
                value: id,
                title: name,
                name:
                  `${symbol}${
                    contract_address ?
                      `: ${
                        ellipse(
                          contract_address,
                          16,
                        )
                      }` :
                      ''
                  }`,
              }
            }),
      },
      {
        label: 'Amount',
        name: 'amount',
        type: 'number',
        placeholder: 'Amount',
      },
    ]

  const notificationResponse =
    addResponse ||
    approveResponse

  const {
    status,
    message,
    tx_hash,
  } = { ...notificationResponse }

  const max_amount =
    balance ||
    0

  const hasAllFields =
    fields.length === fields
      .filter(f =>
        data?.[f.name]
      ).length

  const disabled =
    adding ||
    approving

  return (
    <>
      {
        notificationResponse &&
        (
          <Notification
            hideButton={true}
            outerClassNames="w-full h-auto z-50 transform fixed top-0 left-0 p-0"
            innerClassNames={`${status === 'failed' ? 'bg-red-500 dark:bg-red-600' : status === 'success' ? 'bg-green-500 dark:bg-green-600' : 'bg-blue-600 dark:bg-blue-700'} text-white`}
            animation="animate__animated animate__fadeInDown"
            icon={status === 'failed' ?
              <BiMessageError
                className="w-6 h-6 stroke-current mr-2"
              /> :
              status === 'success' ?
                <BiMessageCheck
                  className="w-6 h-6 stroke-current mr-2"
                /> :
                <div className="mr-2">
                  <Watch
                    color="white"
                    width="20"
                    height="20"
                  />
                </div>
            }
            content={<div className="flex items-center">
              <span className="break-all mr-2">
                {message}
              </span>
              {
                url &&
                tx_hash &&
                (
                  <a
                    href={`${url}${transaction_path?.replace('{tx}', tx_hash)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mr-2"
                  >
                    <span className="font-semibold">
                      View on {explorer.name}
                    </span>
                  </a>
                )
              }
              {
                status === 'failed' &&
                message &&
                (
                  <Copy
                    size={24}
                    value={message}
                    className="cursor-pointer text-slate-200 hover:text-white"
                  />
                )
              }
            </div>}
            onClose={() => {
              setApproveResponse(null)
              setAddResponse(null)
            }}
          />
        )
      }
      <Modal
        hidden={hidden}
        disabled={disabled}
        onClick={() => setHidden(false)}
        buttonTitle={
          address ?
            <div className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-400 rounded-lg shadow flex items-center justify-center text-white space-x-1.5 py-1.5 px-2">
              <span className="text-sm font-semibold">
                Manage Router
              </span>
            </div> :
            <TailSpin
              color={loader_color(theme)}
              width="24"
              height="24"
            />
        }
        buttonClassName={`min-w-max ${disabled ? 'cursor-not-allowed' : ''} flex items-center justify-center`}
        title={<div className="flex items-center justify-between">
          <span>
            Add Router Liquidity
          </span>
          <div
            onClick={() => setHidden(true)}
            className="hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer rounded-full p-2"
          >
            <BiX
              size={18}
            />
          </div>
        </div>}
        body={<div className="form mt-2">
          {fields
            .map((f, i) => {
              const {
                label,
                name,
                type,
                placeholder,
                options,
                className,
              } = { ...f }

              return (
                <div
                  key={i}
                  className={`form-element ${className || ''}`}
                >
                  {label && (
                    <div className="flex items-center justify-between space-x-2">
                      <div className="form-label text-slate-600 dark:text-slate-200 font-normal">
                        {label}
                      </div>
                      {
                        name === 'amount' &&
                        wallet_address &&
                        typeof balance === 'number' &&
                        (
                          <div
                            onClick={() =>
                              setData(
                                {
                                  ...data,
                                  [`${name}`]: max_amount,
                                }
                              )
                            }
                            className="cursor-pointer flex items-center text-black dark:text-white space-x-1.5 mb-2"
                          >
                            <span>
                              Balance:
                            </span>
                            <span className="font-bold">
                              {number_format(
                                balance,
                                '0,0.000000',
                                true,
                              )}
                            </span>
                          </div>
                        )
                      }
                    </div>
                  )}
                  {type === 'select' ?
                    <select
                      placeholder={placeholder}
                      value={data?.[name]}
                      onChange={e =>
                        setData(
                          {
                            ...data,
                            [`${name}`]: e.target.value,
                          }
                        )
                      }
                      className="form-select bg-slate-50 border-0 focus:ring-0 rounded-lg"
                    >
                      {(options || [])
                        .map((o, j) => {
                          const {
                            title,
                            value,
                            name,
                          } = { ...o }

                          return (
                            <option
                              key={j}
                              title={title}
                              value={value}
                            >
                              {name}
                            </option>
                          )
                        })
                      }
                    </select> :
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={data?.[name]}
                      onChange={e => {
                        let value

                        if (type === 'number') {
                          const regex = /^[0-9.\b]+$/

                          if (
                            e.target.value === '' ||
                            regex.test(e.target.value)
                          ) {
                            value = e.target.value
                          }

                          value =
                            value < 0 ?
                              0 :
                              value
                        }
                        else {
                          value = e.target.value
                        }

                        setData(
                          {
                            ...data,
                            [`${name}`]: value,
                          }
                        )
                      }}
                      className="form-input border-0 focus:ring-0 rounded-lg"
                    />
                  }
                </div>
              )
            })
          }
          <div className="w-full flex items-center justify-end space-x-3 pt-2">
            <EnsProfile
              address={wallet_address}
              fallback={
                wallet_address &&
                (
                  <Copy
                    value={wallet_address}
                    title={<span className="text-slate-400 dark:text-slate-200 text-sm">
                      <span className="xl:hidden">
                        {ellipse(
                          wallet_address,
                          8,
                        )}
                      </span>
                      <span className="hidden xl:block">
                        {ellipse(
                          wallet_address,
                          12,
                        )}
                      </span>
                    </span>}
                  />
                )
              }
            />
            <Wallet
              connectChainId={chain_data?.chain_id}
            />
          </div>
        </div>}
        noCancelOnClickOutside={
          notificationResponse ||
          true
        }
        cancelDisabled={disabled}
        onCancel={() => reset()}
        confirmDisabled={disabled ||
          !(
            amount > 0 &&
            amount <= max_amount
          )
        }
        onConfirm={() => addLiquidty()}
        onConfirmHide={false}
        confirmButtonTitle={<span className="flex items-center justify-center space-x-1.5">
          {
            disabled &&
            (
              <TailSpin
                color="white"
                width="20"
                height="20"
              />
            )
          }
          <span>
            {adding ?
              approving ?
                approveProcessing ?
                  'Approving' :
                  'Please Approve' :
                addProcessing ?
                  'Adding' :
                  typeof approving === 'boolean' ?
                    'Please Confirm' :
                    'Checking Approval' :
              'Add'
            }
          </span>
        </span>}
        onClose={() => reset()}
        noButtons={
          !hasAllFields ||
          !web3_provider ||
          chain_id !== wallet_chain_id
        }
      />
    </>
  )
}