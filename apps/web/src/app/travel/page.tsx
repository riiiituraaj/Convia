"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Hotel, Plane, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { TravelSearchResult } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type TravelMode = "flights" | "hotels";

export default function TravelPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<TravelMode>("flights");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [result, setResult] = useState<TravelSearchResult | null>(null);
  const statusQuery = useQuery({ queryKey: ["travel-status"], queryFn: () => api.getTravelStatus() });

  const searchMutation = useMutation({
    mutationFn: () => mode === "flights"
      ? api.searchFlights({ origin: origin.trim(), destination: destination.trim(), departure_date: departure })
      : api.searchHotels({ destination: destination.trim(), check_in_date: checkIn, check_out_date: checkOut }),
    onSuccess: setResult,
    onError: (error: Error) => toast({ title: "Travel search unavailable", description: error.message, tone: "danger" }),
  });

  const providers = Object.values(statusQuery.data?.providers || {});
  const credentialsPresent = providers.some((provider) => provider.configured);

  return (
    <div className="space-y-7 animate-fade-in">
      <PageHeader
        eyebrow="Travel planning"
        title="Travel search"
        description="Compare your trip requirements and open official search pages for current availability. CONVIA does not show estimated or invented prices."
        icon={<Plane className="h-5 w-5" strokeWidth={1.75} />}
      />

      <Card className="border-warning/30 bg-warning-light/40">
        <CardBody className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Live inventory and booking are not connected</p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              {statusQuery.data?.policy || "No travel provider inventory has been queried. Search links lead to third-party provider sites."}
            </p>
          </div>
          <Badge tone={credentialsPresent ? "warning" : "neutral"}>
            {statusQuery.isLoading ? "Checking providers" : statusQuery.isError ? "Status unavailable" : credentialsPresent ? "Keys present · adapter unavailable" : "No provider connected"}
          </Badge>
        </CardBody>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex gap-2" aria-label="Travel search type">
          <Button type="button" aria-pressed={mode === "flights"} variant={mode === "flights" ? "primary" : "outline"} onClick={() => { setMode("flights"); setResult(null); }}>
            <Plane className="h-4 w-4" /> Flights
          </Button>
          <Button type="button" aria-pressed={mode === "hotels"} variant={mode === "hotels" ? "primary" : "outline"} onClick={() => { setMode("hotels"); setResult(null); }}>
            <Hotel className="h-4 w-4" /> Hotels
          </Button>
        </div>

        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => { event.preventDefault(); setResult(null); searchMutation.mutate(); }}
        >
          {mode === "flights" ? (
            <label className="text-xs font-medium text-ink-secondary">
              Origin
              <input required maxLength={50} value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="City or airport code" className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand" />
            </label>
          ) : null}
          <label className="text-xs font-medium text-ink-secondary">
            Destination
            <input required maxLength={100} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="City or region" className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand" />
          </label>
          {mode === "flights" ? (
            <label className="text-xs font-medium text-ink-secondary">
              Departure date
              <input required type="date" value={departure} onChange={(event) => setDeparture(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand" />
            </label>
          ) : (
            <>
              <label className="text-xs font-medium text-ink-secondary">
                Check in
                <input required type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand" />
              </label>
              <label className="text-xs font-medium text-ink-secondary">
                Check out
                <input required type="date" min={checkIn || undefined} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand" />
              </label>
            </>
          )}
          <div className="flex items-end">
            <Button type="submit" loading={searchMutation.isPending} className="w-full">
              <Search className="h-4 w-4" /> Search official sources
            </Button>
          </div>
        </form>
      </Card>

      {result ? (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Search status</h2>
                <p className="mt-1 text-sm text-ink-secondary">{result.message}</p>
              </div>
              <Badge tone={result.live_inventory_available ? "success" : "neutral"}>
                {result.live_inventory_available ? "Live inventory checked" : "No live inventory checked"}
              </Badge>
            </div>
            {result.offers.length ? (
              <ul className="mt-4 space-y-2">
                {result.offers.map((offer, index) => <li key={String(offer.id || index)} className="rounded-lg border border-line p-3 text-sm">{String(offer.name || offer.title || "Provider offer")}</li>)}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-sm text-ink-muted">No price or availability offer was returned. Use one of the provider search links below to check current results.</p>
            )}
            {result.official_search_links.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.official_search_links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex h-full items-start justify-between gap-3 rounded-xl border border-line-subtle bg-surface-muted p-4 transition-colors hover:border-brand">
                      <span>
                        <span className="block text-sm font-semibold text-ink">{link.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-ink-secondary">{link.notes}</span>
                      </span>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-4 text-[11px] text-ink-muted">Review provider details, terms, and final price on the destination site. CONVIA does not book or submit traveler data.</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
